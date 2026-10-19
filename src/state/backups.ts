import { type LibraryPreset, presetFromToneprint } from '../protocol/backup';
import { PRESET_COUNT } from '../protocol/constants';
import type { PresetAssignment, Toneprint } from '../protocol/model';
import { boardOf } from './presets';

const locationKey = (board: number, slot: number): string => `${board}:${slot}`;

/**
 * The pedal's 128 locations as backup-file presets, in file order (1A, 1B … 64B).
 * Lists the locations whose preset data is not known yet.
 */
export function presetsFromPedal(
  assignments: readonly PresetAssignment[],
  toneprints: Readonly<Record<string, Toneprint>>,
): { presets: LibraryPreset[]; missing: string[] } {
  const byLocation = new Map(assignments
    .filter((a) => a.group === 0)
    .map((a) => [locationKey(a.board, a.slot), a.toneprintId]));
  const presets: LibraryPreset[] = [];
  const missing: string[] = [];
  for (let index = 0; index < PRESET_COUNT; index += 1) {
    const board = boardOf(index);
    const slot = index % 2;
    const toneprint = toneprints[byLocation.get(locationKey(board, slot)) ?? ''];
    if (toneprint) presets.push(presetFromToneprint(toneprint));
    else missing.push(`${board}${slot === 0 ? 'A' : 'B'}`);
  }
  return { presets, missing };
}

/** Indexes of the locations where a backup file differs from what is on the pedal now. */
export function changedLocations(
  presets: readonly LibraryPreset[],
  assignments: readonly PresetAssignment[],
): number[] {
  const byLocation = new Map(assignments
    .filter((a) => a.group === 0)
    .map((a) => [locationKey(a.board, a.slot), a.toneprintId]));
  return presets
    .map((preset, index) => ({ preset, index }))
    .filter(({ preset, index }) => (
      byLocation.get(locationKey(boardOf(index), index % 2)) !== preset.id
    ))
    .map(({ index }) => index);
}

/** A file name such as "2290P backup 2026-10-19.tc2290B". */
export const backupFileName = (date: Date): string => (
  `2290P backup ${date.toISOString().slice(0, 10)}.tc2290B`
);
