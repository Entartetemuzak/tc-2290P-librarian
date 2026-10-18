import ByteWriter from './ByteWriter';
import {
  Command, EFFECT_ID_2290, PROTOCOL_VERSION, SYSEX_COMMAND_PROTOCOL, SYSEX_KEEP_ALIVE,
} from './constants';
import { buildSysEx } from './frame';
import { writeHeader } from './header';
import {
  type PresetAssignment, type Toneprint, writeAssignment, writeSettingsGroup, writeToneprint,
} from './model';
import { Table, writeQuery } from './query';

const protocolMessage = (writer: ByteWriter): number[] => (
  buildSysEx(SYSEX_COMMAND_PROTOCOL, writer.bytes)
);

/** The probe the vendor app uses for discovery. */
export function buildVersionRequest(sessionId: number): number[] {
  const w = writeHeader(new ByteWriter(), Command.VERSION_REQUEST, sessionId);
  [1, 1, PROTOCOL_VERSION, 0, 10].forEach((v) => w.uint(v));
  return protocolMessage(w);
}

export function buildKeepAlive(): number[] {
  return buildSysEx(SYSEX_KEEP_ALIVE);
}

type ReadParameter = 'uint' | 'optional';

/** A CRUD read request with an empty query, as the vendor app sends during its initial dump. */
export function buildReadRequest(
  commandId: number,
  table: string,
  sessionId: number,
  parameter: ReadParameter = 'uint',
): number[] {
  const w = writeHeader(new ByteWriter(), commandId, sessionId);
  writeQuery(w, { table });
  if (parameter === 'uint') w.uint(0);
  else w.optional(null, () => undefined);
  return protocolMessage(w);
}

export const buildSettingsRead = (sessionId: number): number[] => (
  buildReadRequest(Command.SETTINGS_READ, Table.SETTINGS_GROUP, sessionId)
);
export const buildAssignmentsRead = (sessionId: number): number[] => (
  buildReadRequest(Command.ASSIGNED_READ, Table.ASSIGNED_TONEPRINT, sessionId)
);
export const buildPcMapRead = (sessionId: number): number[] => (
  buildReadRequest(Command.MIDI_PC_READ, Table.MIDI_PC_MAPPING, sessionId)
);
export const buildCcMapRead = (sessionId: number): number[] => (
  buildReadRequest(Command.MIDI_CC_READ, Table.MIDI_CC_MAPPING, sessionId)
);
export const buildToneprintRead = (sessionId: number): number[] => (
  buildReadRequest(Command.TONEPRINT_READ, Table.TONEPRINT, sessionId, 'optional')
);

/**
 * Selects the active preset by writing SystemState, exactly as the vendor app does.
 * @param board 1–64
 * @param slot 0 = preset A, 1 = preset B
 */
export function buildSelectPreset(sessionId: number, board: number, slot: number): number[] {
  const w = writeHeader(new ByteWriter(), Command.SETTINGS_UPDATE, sessionId);
  writeQuery(w, {
    table: Table.SETTINGS_GROUP,
    listB: ['value'],
    include: [{
      table: Table.SETTINGS_GROUP,
      where: [{ op: 0, field: 'name', value: 'SystemState' }],
      include: [{ table: Table.SETTING }],
    }],
  });
  w.vector([{
    name: 'SystemState',
    settings: [
      { key: 'currentBoard', value: String(board) },
      { key: 'currentSlot', value: String(slot) },
    ],
  }], writeSettingsGroup);
  return protocolMessage(w);
}

/** Uploads one TonePrint, as the vendor app does during Restore Backup. */
export function buildToneprintCreate(
  sessionId: number,
  toneprint: Omit<Toneprint, 'effectId'> & { effectId?: number },
): number[] {
  const w = writeHeader(new ByteWriter(), Command.TONEPRINT_CREATE, sessionId);
  writeQuery(w, { table: Table.TONEPRINT });
  writeToneprint(w, { ...toneprint, effectId: toneprint.effectId ?? EFFECT_ID_2290 });
  return protocolMessage(w);
}

/** Writes the complete board/slot → TonePrint table. */
export function buildAssignmentsUpdate(
  sessionId: number,
  assignments: readonly PresetAssignment[],
): number[] {
  const w = writeHeader(new ByteWriter(), Command.ASSIGNED_UPDATE, sessionId);
  writeQuery(w, { table: Table.ASSIGNED_TONEPRINT });
  w.vector(assignments, writeAssignment);
  return protocolMessage(w);
}

/**
 * Status values the vendor app uses when it acknowledges a request pushed by
 * the pedal. Every acknowledgement carries the single payload byte 0x00.
 */
const ACK_STATUS: Readonly<Record<number, number>> = {
  [Command.TONEPRINT_CREATE]: 0,
  [Command.TONEPRINT_UPDATE]: 0,
  [Command.SETTINGS_UPDATE]: 0xffffffff,
  [Command.ASSIGNED_UPDATE]: 0,
  [Command.LIVE_UPDATE]: 0xffffffff,
};

export const isAcknowledgedPush = (commandId: number): boolean => commandId in ACK_STATUS;

export function buildAcknowledgement(requestCommandId: number, sessionId: number): number[] {
  const status = ACK_STATUS[requestCommandId] ?? 0;
  const w = writeHeader(new ByteWriter(), requestCommandId + 1, sessionId, status);
  w.uint(0);
  return protocolMessage(w);
}
