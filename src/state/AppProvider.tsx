import {
  type ReactNode, useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef,
} from 'react';
import DeviceLink from '../midi/DeviceLink';
import {
  describeAccessError, findPedalPort, isWebMidiSupported, listPorts, requestMidiAccess,
} from '../midi/webMidi';
import {
  type LibraryPreset, parseBackup, renamePreset as renameLibraryPreset, serializeBackup,
} from '../protocol/backup';
import { delayTimeDigits } from '../protocol/ccMap';
import { EFFECT_ID_2290 } from '../protocol/constants';
import type { PresetAssignment } from '../protocol/model';
import downloadText from '../utils/download';
import { type AppActions, AppContext } from './context';
import { boardOf } from './presets';
import { initialState, reducer } from './reducer';
import type { AppState, PresetSource, ViewId } from './types';

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
    midiStatus: isWebMidiSupported() ? 'idle' : 'unsupported',
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

  const refreshPorts = useCallback(() => {
    if (!access.current) return;
    const { inputs, outputs } = listPorts(access.current);
    dispatch({ type: 'ports', inputs, outputs });
    const { current } = stateRef;
    dispatch({
      type: 'choosePorts',
      inputId: current.inputId || findPedalPort(inputs)?.id || inputs[0]?.id || '',
      outputId: current.outputId || findPedalPort(outputs)?.id || outputs[0]?.id || '',
    });
  }, []);

  const disconnect = useCallback(() => {
    link.current?.dispose();
    link.current = null;
    dispatch({ type: 'link', mode: 'disconnected' });
  }, []);

  useEffect(() => () => link.current?.dispose(), []);

  const connectAsync = useCallback(async () => {
    const midi = access.current;
    const { inputId, outputId } = stateRef.current;
    const input = midi?.inputs.get(inputId);
    const output = midi?.outputs.get(outputId);
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
    const settings = await device.readSettings();
    dispatch({ type: 'pedalData', data: { assignments, settings } });
    const current = currentFromSettings(settings);
    if (current) dispatch({ type: 'push', push: { kind: 'presetSelected', ...current } });
    const pcMap = await device.readPcMap();
    const ccMap = await device.readCcMap();
    dispatch({ type: 'pedalData', data: { pcMap, ccMap } });
    dispatch({ type: 'setSource', source: 'pedal' });
    dispatch({ type: 'busy', label: null });
  }, [notify]);

  const enableMidiAsync = useCallback(async () => {
    dispatch({ type: 'midiStatus', status: 'requesting' });
    try {
      const midi = await requestMidiAccess();
      access.current = midi;
      midi.addEventListener('statechange', refreshPorts);
      dispatch({ type: 'midiStatus', status: 'ready' });
      refreshPorts();
    } catch (error) {
      dispatch({ type: 'midiStatus', status: 'error', error: describeAccessError(error) });
    }
  }, [refreshPorts]);

  const openBackupAsync = useCallback(async (file: File) => {
    const doc = await parseBackup(await file.text());
    dispatch({
      type: 'libraryLoaded',
      library: {
        fileName: file.name,
        presets: doc.presets,
        checksumValid: doc.checksumValid,
        modified: false,
      },
    });
    notify(
      doc.checksumValid ? 'info' : 'error',
      doc.checksumValid
        ? `Opened ${file.name}: ${doc.presets.length} presets, checksum OK.`
        : `Opened ${file.name}, but its checksum does not match. The app may refuse to restore it.`,
    );
  }, [notify]);

  const saveBackupAsync = useCallback(async () => {
    const { library } = stateRef.current;
    if (!library) return;
    const text = await serializeBackup(library.presets);
    const base = library.fileName.replace(/\.tc2290B$/i, '');
    downloadText(library.modified ? `${base}-edited.tc2290B` : `${base}.tc2290B`, text);
    dispatch({ type: 'librarySaved' });
    notify('info', 'Backup file saved. Restore it with the 2290 P app or Write to pedal.');
  }, [notify]);

  const readToneprintsAsync = useCallback(async () => {
    const device = link.current;
    if (!device) return;
    dispatch({ type: 'busy', label: 'Reading TonePrints' });
    const toneprints = await device.readToneprints();
    dispatch({ type: 'toneprints', toneprints });
    dispatch({ type: 'busy', label: null });
    notify('info', `Read ${toneprints.length} TonePrints from the pedal.`);
  }, [notify]);

  const writeBackupAsync = useCallback(async () => {
    const device = link.current;
    const { library, assignments } = stateRef.current;
    if (!device || !library) return;
    const onPedal = new Set(assignments.map((a) => a.toneprintId));
    const missing: LibraryPreset[] = library.presets.filter((p) => !onPedal.has(p.id));
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
          artistId: 'local',
          effectId: EFFECT_ID_2290,
        });
      }
    }
    dispatch({ type: 'busy', label: 'Writing preset locations' });
    const next: PresetAssignment[] = library.presets.map((p, index) => ({
      group: 0, board: boardOf(index), slot: index % 2, toneprintId: p.id,
    }));
    await device.writeAssignments(next);
    dispatch({ type: 'pedalData', data: { assignments: next } });
    dispatch({ type: 'busy', label: null });
    notify('info', `Wrote ${missing.length} TonePrints and all 128 preset locations to the pedal.`);
  }, [notify]);

  const actions = useMemo<AppActions>(() => ({
    setView: (view: ViewId) => dispatch({ type: 'setView', view }),
    enableMidi: () => {
      enableMidiAsync().catch(report);
    },
    choosePorts: (inputId, outputId) => {
      disconnect();
      dispatch({ type: 'choosePorts', inputId, outputId });
    },
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
    setSource: (source: PresetSource) => dispatch({ type: 'setSource', source }),
    openBackup: (file) => {
      openBackupAsync(file).catch(report);
    },
    closeBackup: () => dispatch({ type: 'libraryClosed' }),
    renamePreset: (index, name) => {
      const { library } = stateRef.current;
      const preset = library?.presets[index];
      if (!library || !preset || preset.name === name) return;
      const presets = [...library.presets];
      presets[index] = renameLibraryPreset(preset, name);
      dispatch({ type: 'libraryChanged', presets });
    },
    swapPresets: (from, to) => {
      const { library } = stateRef.current;
      const a = library?.presets[from];
      const b = library?.presets[to];
      if (!library || !a || !b || from === to) return;
      const presets = [...library.presets];
      presets[from] = b;
      presets[to] = a;
      dispatch({ type: 'libraryChanged', presets });
      dispatch({ type: 'select', index: to });
    },
    saveBackup: () => {
      saveBackupAsync().catch(report);
    },
    setExperimental: (enabled) => dispatch({ type: 'setExperimental', enabled }),
    readToneprints: () => {
      readToneprintsAsync().catch(report);
    },
    writeBackupToPedal: () => {
      writeBackupAsync().catch(report);
    },
    clearTraffic: () => dispatch({ type: 'clearTraffic' }),
    dismissNotice: () => dispatch({ type: 'notice', notice: null }),
  }), [
    connectAsync, disconnect, enableMidiAsync, openBackupAsync, readToneprintsAsync, report,
    saveBackupAsync, writeBackupAsync,
  ]);

  const value = useMemo(() => ({ state, actions }), [state, actions]);

  return <AppContext value={value}>{children}</AppContext>;
}
