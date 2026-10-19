/** SysEx manufacturer ID of TC Electronic. */
export const MANUFACTURER_ID = [0x00, 0x20, 0x1f] as const;

/** Product ID of the 2290 P (system ID 0x00, model ID 0x36). */
export const PRODUCT_ID = 0x0036;

export const SYSEX_START = 0xf0;
export const SYSEX_END = 0xf7;

/** SysEx command byte that carries the command protocol. */
export const SYSEX_COMMAND_PROTOCOL = 0x68;

/** Keep-alive poll the vendor app sends periodically. The pedal's reply is ignored. */
export const SYSEX_KEEP_ALIVE = 0x05;

export const APP_SENDER_ID = 0;
export const PEDAL_SENDER_ID = 10;
export const PROTOCOL_VERSION = 6;

/** artistId the pedal reports for factory presets; presets stored on the pedal carry "local". */
export const FACTORY_ARTIST_ID = '1210';
export const LOCAL_ARTIST_ID = 'local';

/** Effect ID of the 2290 delay algorithm, as reported by the pedal. */
export const EFFECT_ID_2290 = 48012;

/** Number of boards on the pedal; each board holds preset A and preset B. */
export const BOARD_COUNT = 64;
export const PRESET_COUNT = BOARD_COUNT * 2;

/** Command IDs. Requests are even; the response is request + 1. */
export const Command = {
  VERSION_REQUEST: 4,
  VERSION_RESPONSE: 5,
  EVENT_REQUEST: 6,
  EVENT_RESPONSE: 7,
  TONEPRINT_CREATE: 30,
  TONEPRINT_CREATE_RESPONSE: 31,
  TONEPRINT_READ: 32,
  TONEPRINT_READ_RESPONSE: 33,
  TONEPRINT_UPDATE: 34,
  TONEPRINT_UPDATE_RESPONSE: 35,
  EFFECT_READ: 52,
  EFFECT_READ_RESPONSE: 53,
  SETTINGS_READ: 92,
  SETTINGS_READ_RESPONSE: 93,
  SETTINGS_UPDATE: 94,
  SETTINGS_UPDATE_RESPONSE: 95,
  MIDI_PC_READ: 102,
  MIDI_PC_READ_RESPONSE: 103,
  MIDI_CC_READ: 112,
  MIDI_CC_READ_RESPONSE: 113,
  ASSIGNED_READ: 1002,
  ASSIGNED_READ_RESPONSE: 1003,
  ASSIGNED_UPDATE: 1004,
  ASSIGNED_UPDATE_RESPONSE: 1005,
  LIVE_READ: 1012,
  LIVE_READ_RESPONSE: 1013,
  LIVE_UPDATE: 1014,
  LIVE_UPDATE_RESPONSE: 1015,
} as const;

/** Header status value seen on pings pushed by the pedal. */
export const STATUS_PING = 3;

export const COMMAND_NAMES: Readonly<Record<number, string>> = {
  4: 'Version request',
  5: 'Version response',
  6: 'Event request',
  7: 'Event response',
  30: 'TonePrint create',
  31: 'TonePrint create response',
  32: 'TonePrint read',
  33: 'TonePrint read response',
  34: 'TonePrint update',
  35: 'TonePrint update response',
  52: 'Effect read',
  53: 'Effect read response',
  92: 'Settings read',
  93: 'Settings read response',
  94: 'Settings update',
  95: 'Settings update response',
  102: 'MIDI PC map read',
  103: 'MIDI PC map read response',
  112: 'MIDI CC map read',
  113: 'MIDI CC map read response',
  1002: 'Preset assignments read',
  1003: 'Preset assignments read response',
  1004: 'Preset assignments update',
  1005: 'Preset assignments update response',
  1012: 'Live state read',
  1013: 'Live state read response',
  1014: 'Live state update',
  1015: 'Live state update response',
};
