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

/** The pedal's 128 preset locations, with names and data where they are known. */
export function buildPresetSlots(state: AppState): PresetSlot[] {
  const assignment = new Map(state.assignments
    .filter((a) => a.group === 0)
    .map((a) => [`${a.board}:${a.slot}`, a.toneprintId]));

  return Array.from({ length: PRESET_COUNT }, (_, index) => {
    const board = boardOf(index);
    const slot = index % 2;
    const toneprintId = assignment.get(`${board}:${slot}`) ?? null;
    const known = toneprintId ? state.toneprints[toneprintId] : undefined;
    return {
      index,
      board,
      slot,
      label: slotLabel(board, slot),
      name: known?.name ?? null,
      toneprintId,
      data: known?.data ?? null,
      isCurrent: state.current?.board === board && state.current.slot === slot,
    };
  });
}
