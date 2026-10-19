import { DATA_WORDS } from './params';

/** One preset in a backup file (.tc2290B), in the order 1A, 1B, 2A … 64B. */
export interface LibraryPreset {
  name: string;
  /** TonePrint ID: 32 lowercase hex characters. */
  id: string;
  /** TonePrint data: 71 signed 32-bit integers. */
  data: number[];
}

export interface BackupDocument {
  contentType: string;
  presets: LibraryPreset[];
  checksumValid: boolean;
}

interface BackupEntry {
  Name: string;
  Id: string;
  'Preset data': string;
}

const CONTENT_TYPE = 'Board presets';
const CHECKSUM_KEY = 'Key';
const NAME_BYTES = 20;
export const MAX_NAME_LENGTH = NAME_BYTES - 1;

export function dataFromBase64(base64: string): number[] {
  const binary = atob(base64);
  const view = new DataView(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i += 1) view.setUint8(i, binary.charCodeAt(i));
  return Array.from({ length: DATA_WORDS }, (_, i) => view.getInt32(i * 4, false));
}

export function dataToBase64(data: readonly number[]): string {
  const view = new DataView(new ArrayBuffer(DATA_WORDS * 4));
  data.forEach((word, i) => view.setInt32(i * 4, word, false));
  let binary = '';
  for (let i = 0; i < view.byteLength; i += 1) binary += String.fromCharCode(view.getUint8(i));
  return btoa(binary);
}

/** The JUCE JSON formatting the vendor app writes: two-space indent, CRLF line endings. */
const toJuceJson = (value: unknown): string => (
  JSON.stringify(value, null, 2).replace(/\n/g, '\r\n')
);

const toEntry = (preset: LibraryPreset): BackupEntry => ({
  Name: preset.name,
  Id: preset.id,
  'Preset data': dataToBase64(preset.data),
});

/** HMAC-SHA256 with the key "Key" over the Presets array, as lowercase hex. */
export async function computeChecksum(entries: readonly BackupEntry[]): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(CHECKSUM_KEY),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(toJuceJson(entries)));
  return Array.from(new Uint8Array(signature), (b) => b.toString(16).padStart(2, '0')).join('');
}

const isBackupEntry = (value: unknown): value is BackupEntry => {
  if (typeof value !== 'object' || value === null) return false;
  const entry = value as Record<string, unknown>;
  return typeof entry.Name === 'string'
    && typeof entry.Id === 'string'
    && typeof entry['Preset data'] === 'string';
};

export class BackupFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackupFormatError';
  }
}

export async function parseBackup(text: string): Promise<BackupDocument> {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new BackupFormatError('The file is not valid JSON, so it is not a 2290 P backup.');
  }
  const doc = json as Record<string, unknown>;
  const entries = doc.Presets;
  if (!Array.isArray(entries) || !entries.every(isBackupEntry)) {
    throw new BackupFormatError('The file has no preset list. Choose a .tc2290B backup file.');
  }
  const presets = entries.map((entry) => ({
    name: entry.Name,
    id: entry.Id,
    data: dataFromBase64(entry['Preset data']),
  }));
  const checksum = typeof doc.CheckSum === 'string' ? doc.CheckSum.toLowerCase() : '';
  return {
    contentType: typeof doc['Content type'] === 'string' ? doc['Content type'] : '',
    presets,
    checksumValid: checksum === await computeChecksum(entries),
  };
}

export async function serializeBackup(presets: readonly LibraryPreset[]): Promise<string> {
  const entries = presets.map(toEntry);
  return toJuceJson({
    'Content type': CONTENT_TYPE,
    Presets: entries,
    CheckSum: await computeChecksum(entries),
  });
}

/** A fresh TonePrint ID, so Restore Backup uploads the changed preset instead of skipping it. */
export function newToneprintId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

const cleanName = (name: string): string => (
  name.replace(/[^\x20-\x7e]/g, '').slice(0, MAX_NAME_LENGTH)
);

/** Writes the name into data words 0–5 the way backup files store it (0, then 20 name bytes). */
export function withNameHeader(data: readonly number[], name: string): number[] {
  const clean = cleanName(name);
  const view = new DataView(new ArrayBuffer(NAME_BYTES));
  for (let i = 0; i < clean.length; i += 1) view.setUint8(i, clean.charCodeAt(i));
  const result = [...data];
  result[0] = 0;
  for (let w = 0; w < NAME_BYTES / 4; w += 1) result[1 + w] = view.getInt32(w * 4, false);
  return result;
}

/**
 * Renames a preset. The name is stored twice: in the backup entry and in data
 * words 1–5 (20 bytes, null-terminated). The preset gets a new ID.
 */
export function renamePreset(preset: LibraryPreset, name: string): LibraryPreset {
  const clean = cleanName(name);
  return { name: clean, id: newToneprintId(), data: withNameHeader(preset.data, clean) };
}

/** A backup entry for a TonePrint read from the pedal, keeping its ID. */
export function presetFromToneprint(toneprint: { id: string; name: string; data: number[] }):
LibraryPreset {
  return {
    name: toneprint.name,
    id: toneprint.id,
    data: withNameHeader(toneprint.data, toneprint.name),
  };
}
