import {
  type ReactNode, useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef,
} from 'react';
import DeviceLink from '../midi/DeviceLink';
import {
  describeAccessError, findInput, findOutput, findPedalPort, inspectMidi, listPorts,
  requestMidiAccess, watchPorts,
} from '../midi/webMidi';
import {
  type LibraryPreset, cleanPresetName, newToneprintId, parseBackup, serializeBackup,
} from '../protocol/backup';
import { delayTimeDigits } from '../protocol/ccMap';
import { EFFECT_ID_2290, LOCAL_ARTIST_ID } from '../protocol/constants';
import type { PresetAssignment, Toneprint } from '../protocol/model';
import downloadText from '../utils/download';
import { type AppActions, AppContext } from './context';
import { backupFileName, presetsFromPedal } from './backups';
import { boardOf, slotLabel } from './presets';
import { clearToneprintCache, loadToneprintCache, saveToneprintCache } from './toneprintCache';
import { initialState, reducer } from './reducer';
import type { AppState, ViewId } from './types';

const errorText = (error: unknown): string => (
  error instanceof Error ? error.message : 'Something went wrong.'
);

const currentFromSettings = (
  groups: { name: string; settings: { key: string; value: string }[] }[],
): { board: number; slot: number } | null => {
  const state = groups.find((g) => g.name === 'SystemState');
  const board = Number(state?.settings.find((s) => s.key === 'currentBoard')?.value);
  const slot = Number(state?.settings.find((s) => s.key === 'currentSlot')?.value);
  return Number.isFinite(board) && Number.isFinite(slot) ? { board, slot } : null;
};

export default function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState, (init): AppState => ({
    ...init,
    toneprints: loadToneprintCache(),
  }));
  const access = useRef<MIDIAccess | null>(null);
  const link = useRef<DeviceLink | null>(null);
  const stateRef = useRef(state);
  useLayoutEffect(() => {
    stateRef.current = state;
  });

  const notify = useCallback((tone: 'info' | 'error', text: string) => {
    dispatch({ type: 'notice', notice: { tone, text } });
  }, []);

  const report = useCallback((error: unknown) => {
    dispatch({ type: 'busy', label: null });
    notify('error', errorText(error));
  }, [notify]);

  /** True once the user picks ports by hand; until then the pedal's ports are picked. */
  const userChosePorts = useRef(false);
  /** Ports announced through state-change events, in case the port maps stay empty. */
  const announcedPorts = useRef(new Map<string, MIDIPort>());
  const announced = (): MIDIPort[] => [...announcedPorts.current.values()];
  /** What happened at each request for MIDI access, for troubleshooting. */
  const accessAttempts = useRef<string[]>([]);
  /** False when the browser granted MIDI without SysEx. */
  const sysexAllowed = useRef(true);

  const refreshPorts = useCallback(() => {
    if (!access.current) return;
    const { inputs, outputs } = listPorts(access.current, announced());
    dispatch({ type: 'ports', inputs, outputs });
    dispatch({
      type: 'midiDebug',
      text: inspectMidi(access.current, announced(), accessAttempts.current),
    });
    const { current } = stateRef;
    const pick = (ports: typeof inputs, chosen: string): string => {
      const stillThere = ports.some((p) => p.id === chosen);
      const pedal = findPedalPort(ports);
      // Ports can appear one by one (e.g. a network session before the pedal), so switch
      // to the pedal when it shows up unless the user has chosen ports themselves.
      if (pedal && !userChosePorts.current && current.link === 'disconnected') return pedal.id;
      if (stillThere) return chosen;
      return pedal?.id ?? ports[0]?.id ?? '';
    };
    dispatch({
      type: 'choosePorts',
      inputId: pick(inputs, current.inputId),
      outputId: pick(outputs, current.outputId),
    });
  }, []);

  // Some Web MIDI implementations announce ports late or never send change events,
  // so look again every two seconds while MIDI is enabled.
  useEffect(() => {
    if (state.midiStatus !== 'ready') return undefined;
    const timer = setInterval(refreshPorts, 2000);
    return () => clearInterval(timer);
  }, [state.midiStatus, refreshPorts]);

  const disconnect = useCallback(() => {
    link.current?.dispose();
    link.current = null;
    dispatch({ type: 'link', mode: 'disconnected' });
  }, []);

  useEffect(() => () => link.current?.dispose(), []);

  useEffect(() => {
    saveToneprintCache(state.toneprints);
  }, [state.toneprints]);

  /**
   * Reads name and parameters for every assigned TonePrint, one request per ID,
   * the way the vendor app does. Already known TonePrints are skipped unless forced.
   */
  const readNames = useCallback(async (device: DeviceLink, force: boolean) => {
    const known = stateRef.current.toneprints;
    const ids = [...new Set(stateRef.current.assignments
      .filter((a) => a.group === 0 && a.toneprintId)
      .map((a) => a.toneprintId))]
      .filter((id) => force || !known[id]);
    let found = 0;
    let batch: Toneprint[] = [];
    for (let i = 0; i < ids.length; i += 1) {
      const id = ids[i] ?? '';
      dispatch({ type: 'busy', label: `Reading presets: ${i + 1} of ${ids.length}` });
      // One request at a time keeps the pedal's queue short and the order predictable.
      // eslint-disable-next-line no-await-in-loop
      const toneprint = await device.readToneprint(id);
      if (toneprint) {
        found += 1;
        batch.push(toneprint);
      }
      if (i === 2 && found === 0) {
        dispatch({ type: 'busy', label: null });
        notify('error', 'The pedal returned no preset data. Open a backup file to see names.');
        return;
      }
      if (batch.length >= 8 || i === ids.length - 1) {
        dispatch({ type: 'toneprints', toneprints: batch });
        batch = [];
      }
    }
    dispatch({ type: 'busy', label: null });
    if (force) notify('info', `Read ${found} of ${ids.length} presets from the pedal.`);
  }, [notify]);

  const connectAsync = useCallback(async () => {
    const midi = access.current;
    const { inputId, outputId } = stateRef.current;
    const input = midi ? findInput(midi, inputId, announced()) : undefined;
    const output = midi ? findOutput(midi, outputId, announced()) : undefined;
    if (!input || !output) {
      notify('error', 'Choose a MIDI input and output first.');
      return;
    }
    link.current?.dispose();
    dispatch({ type: 'link', mode: 'connecting' });
    const device = new DeviceLink(input, output, {
      onTraffic: (entry) => dispatch({ type: 'traffic', entry }),
      onPush: (push) => dispatch({ type: 'push', push }),
    });
    link.current = device;
    if (!sysexAllowed.current) {
      dispatch({ type: 'link', mode: 'controlOnly' });
      notify('info', 'Connected for MIDI control only, because this browser does not allow SysEx.');
      return;
    }
    const version = await device.probe();
    if (!version) {
      dispatch({ type: 'link', mode: 'controlOnly' });
      notify('info', 'No 2290 P answered over SysEx. Live control over MIDI CC still works.');
      return;
    }
    dispatch({ type: 'link', mode: 'librarian' });
    dispatch({ type: 'pedalData', data: { version } });
    dispatch({ type: 'busy', label: 'Reading the pedal' });
    const assignments = await device.readAssignments();
    dispatch({ type: 'pedalData', data: { assignments } });
    const settings = await device.readSettings();
    dispatch({ type: 'pedalData', data: { settings } });
    const current = currentFromSettings(settings);
    if (current) dispatch({ type: 'push', push: { kind: 'presetSelected', ...current } });
    const pcMap = await device.readPcMap();
    const ccMap = await device.readCcMap();
    dispatch({ type: 'pedalData', data: { pcMap, ccMap } });
    dispatch({ type: 'busy', label: null });
    stateRef.current = { ...stateRef.current, assignments };
    await readNames(device, false);
  }, [notify, readNames]);

  const enableMidiAsync = useCallback(async () => {
    dispatch({ type: 'midiStatus', status: 'requesting' });
    try {
      accessAttempts.current = [];
      const { access: midi, sysex } = await requestMidiAccess(accessAttempts.current);
      access.current = midi;
      sysexAllowed.current = sysex;
      if (!sysex) {
        notify('error', 'This browser allows MIDI but not SysEx. Live control and Program Change '
          + 'work; preset names, the library and backups need SysEx.');
      }
      watchPorts(midi, (port) => {
        if (port && port.id !== undefined) announcedPorts.current.set(String(port.id), port);
        refreshPorts();
      });
      dispatch({ type: 'midiStatus', status: 'ready' });
      refreshPorts();
    } catch (error) {
      const unsupported = typeof navigator.requestMIDIAccess !== 'function';
      dispatch({
        type: 'midiStatus',
        status: unsupported ? 'unsupported' : 'error',
        error: describeAccessError(error),
      });
      dispatch({ type: 'midiDebug', text: inspectMidi(null, [], accessAttempts.current) });
    }
  }, [notify, refreshPorts]);

  const openBackupAsync = useCallback(async (file: File) => {
    const doc = await parseBackup(await file.text());
    dispatch({
      type: 'toneprints',
      toneprints: doc.presets.map((p) => ({
        id: p.id, name: p.name, data: p.data, artistId: '', effectId: EFFECT_ID_2290,
      })),
    });
    dispatch({
      type: 'backupOpened',
      file: { fileName: file.name, presets: doc.presets, checksumValid: doc.checksumValid },
    });
    if (!doc.checksumValid) {
      notify('error', `${file.name} has a checksum that does not match. It may have been edited.`);
    }
  }, [notify]);

  const backUpPedalAsync = useCallback(async () => {
    const device = link.current;
    if (!device) return;
    await readNames(device, false);
    const { presets, missing } = presetsFromPedal(
      stateRef.current.assignments,
      stateRef.current.toneprints,
    );
    if (missing.length > 0) {
      notify('error', `Could not read ${missing.length} presets (${missing.slice(0, 5).join(', ')}`
        + `${missing.length > 5 ? ' …' : ''}). Try again after Read all presets from the pedal.`);
      return;
    }
    const name = backupFileName(new Date());
    downloadText(name, await serializeBackup(presets));
    notify('info', `Saved all 128 presets to ${name}.`);
  }, [notify, readNames]);

  const loadIntoLocationAsync = useCallback(async (index: number, toneprintId: string) => {
    const device = link.current;
    const { toneprints, assignments } = stateRef.current;
    const toneprint = toneprints[toneprintId];
    if (!device || !toneprint) return;
    const board = boardOf(index);
    const slot = index % 2;
    if (!assignments.some((a) => a.toneprintId === toneprintId)) {
      dispatch({ type: 'busy', label: `Uploading ${toneprint.name}` });
      await device.uploadToneprint({
        ...toneprint,
        artistId: toneprint.artistId || LOCAL_ARTIST_ID,
        effectId: toneprint.effectId || EFFECT_ID_2290,
      });
    }
    dispatch({ type: 'busy', label: 'Writing the preset location' });
    const assignment: PresetAssignment = {
      group: 0, board, slot, toneprintId,
    };
    await device.writeAssignments([assignment]);
    dispatch({ type: 'push', push: { kind: 'assignmentsChanged', assignments: [assignment] } });
    dispatch({ type: 'busy', label: null });
    notify('info', `${toneprint.name} is now on preset ${slotLabel(board, slot)}.`);
  }, [notify]);

  const swapOnPedalAsync = useCallback(async (from: number, to: number) => {
    const device = link.current;
    const { assignments } = stateRef.current;
    const at = (index: number) => assignments.find((a) => a.group === 0
      && a.board === boardOf(index) && a.slot === index % 2);
    const a = at(from);
    const b = at(to);
    if (!device || !a || !b || from === to) return;
    const swapped: PresetAssignment[] = [
      { ...a, toneprintId: b.toneprintId },
      { ...b, toneprintId: a.toneprintId },
    ];
    dispatch({ type: 'busy', label: 'Swapping presets' });
    await device.writeAssignments(swapped);
    dispatch({ type: 'push', push: { kind: 'assignmentsChanged', assignments: swapped } });
    dispatch({ type: 'busy', label: null });
    notify('info', `Swapped ${slotLabel(a.board, a.slot)} and ${slotLabel(b.board, b.slot)}.`);
  }, [notify]);

  const renameOnPedalAsync = useCallback(async (index: number, name: string) => {
    const device = link.current;
    const { assignments, toneprints } = stateRef.current;
    const board = boardOf(index);
    const slot = index % 2;
    const current = assignments.find((a) => a.group === 0 && a.board === board && a.slot === slot);
    const toneprint = current ? toneprints[current.toneprintId] : undefined;
    const clean = cleanPresetName(name);
    if (!device || !toneprint || !clean || clean === toneprint.name) return;
    // Like STORE on the pedal: the renamed preset is a new TonePrint on the same location.
    const renamed = {
      ...toneprint, id: newToneprintId(), name: clean, artistId: LOCAL_ARTIST_ID,
    };
    dispatch({ type: 'busy', label: `Renaming to ${clean}` });
    await device.uploadToneprint(renamed);
    const assignment: PresetAssignment = {
      group: 0, board, slot, toneprintId: renamed.id,
    };
    await device.writeAssignments([assignment]);
    dispatch({ type: 'toneprints', toneprints: [renamed] });
    dispatch({ type: 'push', push: { kind: 'assignmentsChanged', assignments: [assignment] } });
    dispatch({ type: 'busy', label: null });
    notify('info', `${slotLabel(board, slot)} is now called ${clean}.`);
  }, [notify]);

  const restoreBackupAsync = useCallback(async () => {
    const device = link.current;
    const { backupFile, assignments } = stateRef.current;
    if (!device || !backupFile) return;
    const onPedal = new Set(assignments.map((a) => a.toneprintId));
    const missing: LibraryPreset[] = backupFile.presets.filter((p) => !onPedal.has(p.id));
    for (let i = 0; i < missing.length; i += 1) {
      const preset = missing[i];
      if (preset) {
        const label = `Uploading ${i + 1} of ${missing.length}: ${preset.name}`;
        dispatch({ type: 'busy', label });
        // Uploads must happen one at a time, in order.
        // eslint-disable-next-line no-await-in-loop
        await device.uploadToneprint({
          id: preset.id,
          name: preset.name,
          data: preset.data,
          artistId: LOCAL_ARTIST_ID,
          effectId: EFFECT_ID_2290,
        });
      }
    }
    dispatch({ type: 'busy', label: 'Writing preset locations' });
    const next: PresetAssignment[] = backupFile.presets.map((p, index) => ({
      group: 0, board: boardOf(index), slot: index % 2, toneprintId: p.id,
    }));
    await device.writeAssignments(next);
    dispatch({ type: 'pedalData', data: { assignments: next } });
    dispatch({ type: 'busy', label: null });
    dispatch({ type: 'backupClosed' });
    notify('info', `Restored ${backupFile.fileName} to the pedal.`);
  }, [notify]);

  const actions = useMemo<AppActions>(() => ({
    setView: (view: ViewId) => dispatch({ type: 'setView', view }),
    enableMidi: () => {
      enableMidiAsync().catch(report);
    },
    choosePorts: (inputId, outputId) => {
      userChosePorts.current = true;
      disconnect();
      dispatch({ type: 'choosePorts', inputId, outputId });
    },
    refreshPorts,
    connect: () => {
      connectAsync().catch(report);
    },
    disconnect,
    select: (index) => dispatch({ type: 'select', index }),
    recallPreset: (index) => {
      const device = link.current;
      if (!device) return;
      if (stateRef.current.link === 'librarian') {
        device.selectPreset(boardOf(index), index % 2).catch(report);
      } else {
        // Default Program Change map: program n recalls preset n (0 = 1A, 1 = 1B …).
        device.sendProgramChange(stateRef.current.midiChannel, index);
        dispatch({
          type: 'push',
          push: { kind: 'presetSelected', board: boardOf(index), slot: index % 2 },
        });
      }
    },
    sendControl: (controller, value) => {
      link.current?.sendControlChange(stateRef.current.midiChannel, controller, value);
    },
    setDelayTime: (milliseconds) => {
      delayTimeDigits(milliseconds).forEach(({ cc, value }) => {
        link.current?.sendControlChange(stateRef.current.midiChannel, cc, value);
      });
    },
    setChannel: (channel) => dispatch({ type: 'setChannel', channel }),
    openDetails: (target) => dispatch({ type: 'openDetails', target }),
    closeDetails: () => dispatch({ type: 'closeDetails' }),
    loadIntoLocation: (index, toneprintId) => {
      loadIntoLocationAsync(index, toneprintId).catch(report);
    },
    swapOnPedal: (from, to) => {
      swapOnPedalAsync(from, to).catch(report);
    },
    renameOnPedal: (index, name) => {
      renameOnPedalAsync(index, name).catch(report);
    },
    readPresetNames: () => {
      if (link.current) readNames(link.current, true).catch(report);
    },
    forgetPresets: () => {
      clearToneprintCache();
      dispatch({ type: 'forgetToneprints' });
    },
    backUpPedal: () => {
      backUpPedalAsync().catch(report);
    },
    openBackup: (file) => {
      openBackupAsync(file).catch(report);
    },
    closeBackup: () => dispatch({ type: 'backupClosed' }),
    restoreBackup: () => {
      restoreBackupAsync().catch(report);
    },
    clearTraffic: () => dispatch({ type: 'clearTraffic' }),
    dismissNotice: () => dispatch({ type: 'notice', notice: null }),
  }), [
    backUpPedalAsync, connectAsync, disconnect, enableMidiAsync, loadIntoLocationAsync,
    openBackupAsync, readNames, refreshPorts, renameOnPedalAsync, report, restoreBackupAsync,
    swapOnPedalAsync,
  ]);

  const value = useMemo(() => ({ state, actions }), [state, actions]);

  return <AppContext value={value}>{children}</AppContext>;
}
