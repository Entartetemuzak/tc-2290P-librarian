import { describe, expect, it } from 'vitest';
import { libraryKind } from './library';
import { initialState, reducer } from './reducer';

const toneprint = (id: string, artistId: string) => ({
  id, name: `Preset ${id}`, data: Array.from({ length: 71 }, () => 0), artistId, effectId: 48012,
});

describe('library', () => {
  it('classifies presets by the artistId the pedal reports', () => {
    expect(libraryKind(toneprint('a', '1210'))).toBe('factory');
    expect(libraryKind(toneprint('b', 'local'))).toBe('user');
    expect(libraryKind(toneprint('c', ''))).toBe('backup');
  });

  it('keeps a known type when the same preset comes from a backup file', () => {
    const fromPedal = reducer(initialState, {
      type: 'toneprints', toneprints: [toneprint('a', '1210')],
    });
    const fromFile = reducer(fromPedal, { type: 'toneprints', toneprints: [toneprint('a', '')] });
    expect(fromFile.toneprints.a?.artistId).toBe('1210');
  });

  it('opens details for a location and selects it', () => {
    const open = reducer(initialState, {
      type: 'openDetails', target: { kind: 'location', index: 5 },
    });
    expect(open.selectedIndex).toBe(5);
    expect(reducer(open, { type: 'closeDetails' }).details).toBeNull();
  });
});
