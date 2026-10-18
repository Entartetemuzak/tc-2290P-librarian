import {
  MANUFACTURER_ID, PRODUCT_ID, SYSEX_END, SYSEX_START,
} from './constants';
import { pack7, unpack7 } from './packing';

/** Wraps a payload in a TC Electronic SysEx message for the 2290 P. */
export function buildSysEx(sysexCommand: number, payload: readonly number[] = []): number[] {
  return [
    SYSEX_START,
    ...MANUFACTURER_ID,
    Math.floor(PRODUCT_ID / 256),
    PRODUCT_ID % 256,
    sysexCommand,
    ...pack7(payload),
    SYSEX_END,
  ];
}

export interface ParsedSysEx {
  productId: number;
  sysexCommand: number;
  /** Unpacked payload. */
  payload: number[];
}

/** Returns null for anything that is not a complete TC Electronic SysEx message. */
export function parseSysEx(bytes: ArrayLike<number>): ParsedSysEx | null {
  const data = Array.from(bytes);
  if (data.length < 8 || data[0] !== SYSEX_START || data[data.length - 1] !== SYSEX_END) {
    return null;
  }
  if (MANUFACTURER_ID.some((b, i) => data[i + 1] !== b)) return null;
  return {
    productId: (data[4] ?? 0) * 256 + (data[5] ?? 0),
    sysexCommand: data[6] ?? 0,
    payload: unpack7(data.slice(7, -1)),
  };
}

/** Pulls every complete F0 … F7 message out of pasted text, e.g. MIDI Monitor log lines. */
export function extractSysExFromText(text: string): { bytes: number[]; direction: string }[] {
  const found: { bytes: number[]; direction: string }[] = [];
  const pattern = /\b[0-9A-Fa-f]{2}\b/g;
  let current: number[] | null = null;
  let start = 0;
  let match = pattern.exec(text);
  while (match !== null) {
    const value = Number.parseInt(match[0], 16);
    if (value === SYSEX_START) {
      current = [value];
      start = match.index;
    } else if (current !== null) {
      current.push(value);
      if (value === SYSEX_END) {
        const line = text.slice(text.lastIndexOf('\n', start) + 1, start);
        let direction = '';
        if (/\bTo\b/.test(line)) direction = 'out';
        else if (/\bFrom\b/.test(line)) direction = 'in';
        found.push({ bytes: current, direction });
        current = null;
      }
    }
    match = pattern.exec(text);
  }
  return found;
}

export const toHex = (bytes: readonly number[]): string => bytes
  .map((b) => b.toString(16).padStart(2, '0').toUpperCase())
  .join(' ');
