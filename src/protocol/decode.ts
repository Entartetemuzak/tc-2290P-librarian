import ByteReader from './ByteReader';
import {
  COMMAND_NAMES, Command, PEDAL_SENDER_ID, STATUS_PING, SYSEX_COMMAND_PROTOCOL,
} from './constants';
import { parseSysEx } from './frame';
import { type MessageHeader, isResponse, readHeader } from './header';
import {
  readAssignment, readCcMapping, readEffect, readPcMapping, readSettingsGroup, readToneprint,
} from './model';
import { readQuery } from './query';

export interface DecodedMessage {
  /** Short human-readable summary. */
  title: string;
  sysexCommand: number;
  header?: MessageHeader;
  isPing: boolean;
  /** Decoded payload when the command is known. */
  body?: unknown;
  error?: string;
  /** Delay time reported in a live-state push, in milliseconds. */
  liveDelayMs?: number;
}

type BodyReader = (r: ByteReader) => unknown;

const readWithUint: BodyReader = (r) => ({ query: readQuery(r), parameter: r.uint() });
const readWithOptional: BodyReader = (r) => ({
  query: readQuery(r), parameter: r.optional((rr) => rr.uint()),
});

const REQUEST_BODIES: Readonly<Record<number, BodyReader>> = {
  [Command.EVENT_REQUEST]: (r) => ({ eventId: r.uint() }),
  [Command.TONEPRINT_READ]: (r) => ({
    query: readQuery(r), parameter: r.optional((rr) => rr.string()),
  }),
  [Command.EFFECT_READ]: readWithOptional,
  [Command.SETTINGS_READ]: readWithUint,
  [Command.MIDI_PC_READ]: readWithUint,
  [Command.MIDI_CC_READ]: readWithUint,
  [Command.ASSIGNED_READ]: readWithUint,
  [Command.LIVE_READ]: readWithOptional,
  [Command.TONEPRINT_CREATE]: (r) => ({ query: readQuery(r), toneprint: readToneprint(r) }),
  [Command.TONEPRINT_UPDATE]: (r) => ({ query: readQuery(r), toneprint: readToneprint(r) }),
  [Command.SETTINGS_UPDATE]: (r) => ({ query: readQuery(r), groups: r.vector(readSettingsGroup) }),
  [Command.ASSIGNED_UPDATE]: (r) => ({
    query: readQuery(r), assignments: r.vector(readAssignment),
  }),
};

const RESPONSE_BODIES: Readonly<Record<number, BodyReader>> = {
  [Command.VERSION_RESPONSE]: (r) => ({ fields: [r.uint(), r.uint(), r.uint(), r.uint()] }),
  [Command.EVENT_RESPONSE]: () => ({}),
  [Command.TONEPRINT_CREATE_RESPONSE]: (r) => ({ result: r.optional((rr) => rr.string()) }),
  [Command.TONEPRINT_UPDATE_RESPONSE]: (r) => ({ result: r.optional((rr) => rr.string()) }),
  [Command.TONEPRINT_READ_RESPONSE]: (r) => ({ toneprints: r.vector(readToneprint) }),
  [Command.EFFECT_READ_RESPONSE]: (r) => ({ effects: r.vector(readEffect) }),
  [Command.SETTINGS_READ_RESPONSE]: (r) => ({ groups: r.vector(readSettingsGroup) }),
  [Command.SETTINGS_UPDATE_RESPONSE]: (r) => ({ result: r.uint() }),
  [Command.MIDI_PC_READ_RESPONSE]: (r) => ({ mappings: r.vector(readPcMapping) }),
  [Command.MIDI_CC_READ_RESPONSE]: (r) => ({ mappings: r.vector(readCcMapping) }),
  [Command.ASSIGNED_READ_RESPONSE]: (r) => ({ assignments: r.vector(readAssignment) }),
  [Command.ASSIGNED_UPDATE_RESPONSE]: (r) => ({ result: r.uint() }),
  [Command.LIVE_UPDATE_RESPONSE]: (r) => ({ result: r.optional((rr) => rr.uint()) }),
};

/** Delay time in a live-state push: a 2-byte varint 16 bytes from the end, raw / 20 = ms. */
export function liveDelayFromPayload(payload: readonly number[]): number | undefined {
  if (payload.length < 20) return undefined;
  const low = payload[payload.length - 16] ?? 0;
  const high = payload[payload.length - 15] ?? 0;
  return Math.floor((low + high * 256) / 4) / 20;
}

export function decodeMessage(bytes: ArrayLike<number>): DecodedMessage | null {
  const sysex = parseSysEx(bytes);
  if (sysex === null) return null;
  if (sysex.sysexCommand !== SYSEX_COMMAND_PROTOCOL) {
    const label = sysex.sysexCommand.toString(16).toUpperCase().padStart(2, '0');
    return { title: `SysEx command 0x${label}`, sysexCommand: sysex.sysexCommand, isPing: false };
  }
  const reader = new ByteReader(sysex.payload);
  const result: DecodedMessage = { title: '', sysexCommand: sysex.sysexCommand, isPing: false };
  try {
    const header = readHeader(reader);
    result.header = header;
    result.isPing = header.commandId === Command.VERSION_RESPONSE
      && header.status === STATUS_PING
      && header.senderId === PEDAL_SENDER_ID;
    if (result.isPing) {
      result.title = 'Ping';
      return result;
    }
    result.title = COMMAND_NAMES[header.commandId] ?? `Command ${header.commandId}`;
    const bodies = isResponse(header.commandId) ? RESPONSE_BODIES : REQUEST_BODIES;
    const readBody = bodies[header.commandId];
    if (readBody) result.body = readBody(reader);
    if (header.commandId === Command.LIVE_UPDATE) {
      result.liveDelayMs = liveDelayFromPayload(sysex.payload);
    }
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
  }
  return result;
}
