import { PRESET_COUNT } from '../protocol/constants';
import type { AppState } from './types';

export interface PresetSlot {
  index: number;
  board: number;
  /** 0 = A, 1 = B */
  slot: number;
  label: string;
  name: string | null;
  toneprintId: string | null;
  data: number[] | null;
  isCurrent: boolean;
}

export const slotLabel = (board: number, slot: number): string => (
  `${board}${slot === 0 ? 'A' : 'B'}`
);

export const boardOf = (index: number): number => Math.floor(index / 2) + 1;

/** Combines what is known from the pedal and from an open backup file into 128 preset slots. */
export function buildPresetSlots(state: AppState): PresetSlot[] {
  const fromLibrary = state.source === 'library' && state.library !== null;
  const libraryById = new Map((state.library?.presets ?? []).map((p) => [p.id, p]));
  const assignment = new Map(state.assignments
    .filter((a) => a.group === 0)
    .map((a) => [`${a.board}:${a.slot}`, a.toneprintId]));

  return Array.from({ length: PRESET_COUNT }, (_, index) => {
    const board = boardOf(index);
    const slot = index % 2;
    let toneprintId: string | null = null;
    let name: string | null = null;
    let data: number[] | null = null;
    if (fromLibrary) {
      const preset = state.library?.presets[index];
      toneprintId = preset?.id ?? null;
      name = preset?.name ?? null;
      data = preset?.data ?? null;
    } else {
      toneprintId = assignment.get(`${board}:${slot}`) ?? null;
      if (toneprintId) {
        const known = libraryById.get(toneprintId) ?? state.toneprints[toneprintId];
        name = known?.name ?? null;
        data = known?.data ?? null;
      }
    }
    return {
      index,
      board,
      slot,
      label: slotLabel(board, slot),
      name,
      toneprintId,
      data,
      isCurrent: state.current?.board === board && state.current.slot === slot,
    };
  });
}
