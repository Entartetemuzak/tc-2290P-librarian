import type { Toneprint } from '../protocol/model';

/**
 * Presets this browser has seen (from the pedal or from backup files), keyed by
 * TonePrint ID, so names and parameters are available on the next visit.
 * Stored only in this browser's localStorage.
 */
const STORAGE_KEY = 'delay-librarian:toneprints:v1';

const isToneprint = (value: unknown): value is Toneprint => {
  if (typeof value !== 'object' || value === null) return false;
  const t = value as Record<string, unknown>;
  return typeof t.id === 'string' && typeof t.name === 'string' && Array.isArray(t.data);
};

export function loadToneprintCache(): Record<string, Toneprint> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return {};
    const entries = Object.entries(parsed as Record<string, unknown>)
      .filter((entry): entry is [string, Toneprint] => isToneprint(entry[1]));
    return Object.fromEntries(entries);
  } catch {
    return {};
  }
}

export function saveToneprintCache(toneprints: Record<string, Toneprint>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toneprints));
  } catch {
    // Storage can be full or disabled; the cache is a convenience only.
  }
}

export function clearToneprintCache(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clear.
  }
}
