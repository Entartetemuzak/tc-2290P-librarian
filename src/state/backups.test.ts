import { describe, expect, it } from 'vitest';
import { parseBackup, serializeBackup } from '../protocol/backup';
import type { PresetAssignment, Toneprint } from '../protocol/model';
import { backupFileName, changedLocations, presetsFromPedal } from './backups';
import { boardOf } from './presets';

const id = (n: number): string => n.toString(16).padStart(32, '0');

const pedal = (): { assignments: PresetAssignment[]; toneprints: Record<string, Toneprint> } => {
  const assignments = Array.from({ length: 128 }, (_, i) => ({
    group: 0, board: boardOf(i), slot: i % 2, toneprintId: id(i),
  }));
  const toneprints = Object.fromEntries(assignments.map((a, i) => [a.toneprintId, {
    id: a.toneprintId,
    name: `PRESET ${i}`,
    data: [-1, -1, -1, -1, -1, -1, 99, 1000 + i, ...Array.from({ length: 63 }, () => 0)],
    artistId: 'local',
    effectId: 48012,
  }]));
  return { assignments, toneprints };
};

describe('backing up the pedal', () => {
  it('writes all 128 locations in file order with names, as a valid backup', async () => {
    const { assignments, toneprints } = pedal();
    const { presets, missing } = presetsFromPedal([...assignments].reverse(), toneprints);
    expect(missing).toEqual([]);
    expect(presets.map((p) => p.name).slice(0, 3)).toEqual(['PRESET 0', 'PRESET 1', 'PRESET 2']);
    const reopened = await parseBackup(await serializeBackup(presets));
    expect(reopened.checksumValid).toBe(true);
    expect(reopened.presets[5]?.data.slice(6)).toEqual(toneprints[id(5)]?.data.slice(6));
    expect(reopened.presets[5]?.data[0]).toBe(0);
  });

  it('reports locations whose preset data is not known', () => {
    const { assignments, toneprints } = pedal();
    const { [id(3)]: removed, ...rest } = toneprints;
    expect(removed).toBeDefined();
    expect(presetsFromPedal(assignments, rest).missing).toEqual(['2B']);
  });

  it('names backup files by date', () => {
    const date = new Date('2026-10-19T12:00:00Z');
    expect(backupFileName(date)).toBe('2290P backup 2026-10-19.tc2290B');
  });
});

describe('restore preview', () => {
  it('lists only the locations that would change', () => {
    const { assignments, toneprints } = pedal();
    const { presets } = presetsFromPedal(assignments, toneprints);
    const file = [...presets];
    const [first, second] = [file[0], file[1]];
    if (!first || !second) throw new Error('missing presets');
    file[0] = second;
    file[1] = first;
    expect(changedLocations(file, assignments)).toEqual([0, 1]);
    expect(changedLocations(presets, assignments)).toEqual([]);
  });
});
