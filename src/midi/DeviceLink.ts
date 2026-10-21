import ByteReader from '../protocol/ByteReader';
import { Command, STATUS_PING, SYSEX_COMMAND_PROTOCOL } from '../protocol/constants';
import { liveDelayFromPayload } from '../protocol/decode';
import { parseSysEx } from '../protocol/frame';
import { type MessageHeader, isResponse, readHeader } from '../protocol/header';
import {
  buildAcknowledgement, buildAssignmentsRead, buildAssignmentsUpdate, buildCcMapRead,
  buildPcMapRead, buildSelectPreset, buildSettingsRead, buildToneprintCreate,
  buildToneprintRead, buildVersionRequest, isAcknowledgedPush,
} from '../protocol/messages';
import {
  type MidiCcMapping, type MidiPcMapping, type PresetAssignment, type SettingsGroup,
  type Toneprint, readAssignment, readCcMapping, readPcMapping, readSettingsGroup, readToneprint,
} from '../protocol/model';
import { readQuery } from '../protocol/query';
import type { LinkListener, PedalPush } from './types';

interface PendingRequest {
  expectedCommand: number;
  resolve: (reader: ByteReader) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

const DEFAULT_TIMEOUT_MS = 2500;
const PROBE_TIMEOUT_MS = 800;

/**
 * A connection to the pedal over one MIDI input and one MIDI output. Handles
 * request/response matching, acknowledges what the pedal pushes, and sends
 * plain MIDI for live control.
 */
export default class DeviceLink {
  private session = 1;

  private trafficId = 0;

  private readonly pending = new Map<number, PendingRequest>();

  constructor(
    private readonly input: MIDIInput,
    private readonly output: MIDIOutput,
    private readonly listener: LinkListener,
  ) {
    // The callback property is supported more widely than addEventListener, and setting it
    // opens the port.
    this.input.onmidimessage = this.handleMessage;
  }

  dispose(): void {
    if (this.input.onmidimessage === this.handleMessage) this.input.onmidimessage = null;
    this.pending.forEach((p) => {
      clearTimeout(p.timer);
      p.reject(new Error('The connection was closed.'));
    });
    this.pending.clear();
  }

  private nextSession(): number {
    this.session = this.session >= 0x3fff ? 1 : this.session + 1;
    return this.session;
  }

  send(bytes: readonly number[]): void {
    // "Now" as an explicit timestamp: optional in the standard, but some implementations need it.
    this.output.send([...bytes], typeof performance !== 'undefined' ? performance.now() : 0);
    this.trafficId += 1;
    this.listener.onTraffic({
      id: this.trafficId, time: Date.now(), direction: 'out', bytes: [...bytes],
    });
  }

  private request(
    build: (session: number) => number[],
    expectedCommand: number,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  ): Promise<ByteReader> {
    const session = this.nextSession();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(session);
        reject(new Error('The pedal did not answer in time.'));
      }, timeoutMs);
      this.pending.set(session, {
        expectedCommand, resolve, reject, timer,
      });
      this.send(build(session));
    });
  }

  /** Returns the version fields, or null when no 2290 P answers on this port pair. */
  async probe(): Promise<number[] | null> {
    try {
      const r = await this.request(buildVersionRequest, Command.VERSION_RESPONSE, PROBE_TIMEOUT_MS);
      return [r.uint(), r.uint(), r.uint(), r.uint()];
    } catch {
      return null;
    }
  }

  async readSettings(): Promise<SettingsGroup[]> {
    const r = await this.request(buildSettingsRead, Command.SETTINGS_READ_RESPONSE);
    return r.vector(readSettingsGroup);
  }

  async readAssignments(): Promise<PresetAssignment[]> {
    const r = await this.request(buildAssignmentsRead, Command.ASSIGNED_READ_RESPONSE);
    return r.vector(readAssignment);
  }

  /** Reads the Program Change map in both directions, as the vendor app does. */
  async readPcMap(): Promise<MidiPcMapping[]> {
    const first = await this.request((s) => buildPcMapRead(s, 0), Command.MIDI_PC_READ_RESPONSE);
    const mappings = first.vector(readPcMapping);
    const second = await this.request((s) => buildPcMapRead(s, 1), Command.MIDI_PC_READ_RESPONSE);
    return [...mappings, ...second.vector(readPcMapping)];
  }

  async readCcMap(): Promise<MidiCcMapping[]> {
    const r = await this.request(buildCcMapRead, Command.MIDI_CC_READ_RESPONSE);
    return r.vector(readCcMapping);
  }

  /** Reads one TonePrint (name and parameters); null if the pedal does not have it. */
  async readToneprint(toneprintId: string): Promise<Toneprint | null> {
    const r = await this.request(
      (s) => buildToneprintRead(s, toneprintId),
      Command.TONEPRINT_READ_RESPONSE,
    );
    return r.vector(readToneprint)[0] ?? null;
  }

  async selectPreset(board: number, slot: number): Promise<void> {
    await this.request(
      (s) => buildSelectPreset(s, board, slot),
      Command.SETTINGS_UPDATE_RESPONSE,
    );
  }

  async uploadToneprint(toneprint: Toneprint): Promise<string | null> {
    const r = await this.request(
      (s) => buildToneprintCreate(s, toneprint),
      Command.TONEPRINT_CREATE_RESPONSE,
      5000,
    );
    return r.optional((rr) => rr.string());
  }

  async writeAssignments(assignments: readonly PresetAssignment[]): Promise<number> {
    const r = await this.request(
      (s) => buildAssignmentsUpdate(s, assignments),
      Command.ASSIGNED_UPDATE_RESPONSE,
      8000,
    );
    return r.uint();
  }

  sendControlChange(channel: number, controller: number, value: number): void {
    this.send([0xb0 + ((channel - 1) % 16), controller % 128, Math.max(0, Math.min(127, value))]);
  }

  sendProgramChange(channel: number, program: number): void {
    this.send([0xc0 + ((channel - 1) % 16), Math.max(0, Math.min(127, program))]);
  }

  private readonly handleMessage = (event: MIDIMessageEvent): void => {
    if (!event.data) return;
    const bytes = Array.from(event.data);
    this.trafficId += 1;
    this.listener.onTraffic({
      id: this.trafficId, time: Date.now(), direction: 'in', bytes,
    });
    const sysex = parseSysEx(bytes);
    if (sysex === null || sysex.sysexCommand !== SYSEX_COMMAND_PROTOCOL) return;
    const reader = new ByteReader(sysex.payload);
    let header: MessageHeader;
    try {
      header = readHeader(reader);
    } catch {
      return;
    }
    if (header.commandId === Command.VERSION_RESPONSE && header.status === STATUS_PING) {
      this.listener.onPush({ kind: 'ping' });
      return;
    }
    if (isResponse(header.commandId)) {
      const pending = this.pending.get(header.sessionId);
      if (pending && pending.expectedCommand === header.commandId) {
        clearTimeout(pending.timer);
        this.pending.delete(header.sessionId);
        pending.resolve(reader);
      }
      return;
    }
    if (isAcknowledgedPush(header.commandId)) {
      this.send(buildAcknowledgement(header.commandId, header.sessionId));
    }
    const push = DeviceLink.interpretPush(header.commandId, reader, sysex.payload);
    if (push) this.listener.onPush(push);
  };

  private static interpretPush(
    commandId: number,
    reader: ByteReader,
    payload: readonly number[],
  ): PedalPush | null {
    try {
      switch (commandId) {
        case Command.SETTINGS_UPDATE: {
          readQuery(reader);
          const groups = reader.vector(readSettingsGroup);
          const state = groups.find((g) => g.name === 'SystemState');
          const value = (key: string): number => Number(
            state?.settings.find((s) => s.key === key)?.value ?? Number.NaN,
          );
          const board = value('currentBoard');
          const slot = value('currentSlot');
          return Number.isNaN(board) || Number.isNaN(slot)
            ? null : { kind: 'presetSelected', board, slot };
        }
        case Command.ASSIGNED_UPDATE:
          readQuery(reader);
          return { kind: 'assignmentsChanged', assignments: reader.vector(readAssignment) };
        case Command.TONEPRINT_CREATE:
          readQuery(reader);
          return { kind: 'toneprintCreated', toneprint: readToneprint(reader) };
        case Command.LIVE_UPDATE: {
          const milliseconds = liveDelayFromPayload(payload);
          return milliseconds === undefined ? null : { kind: 'liveDelay', milliseconds };
        }
        default:
          return null;
      }
    } catch {
      return null;
    }
  }
}
