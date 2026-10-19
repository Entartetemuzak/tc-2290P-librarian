import { FACTORY_ARTIST_ID, LOCAL_ARTIST_ID } from '../protocol/constants';
import type { Toneprint } from '../protocol/model';

export type LibraryKind = 'factory' | 'user' | 'backup';

/** Short groups first, so they stay visible above the long factory list. */
export const LIBRARY_GROUPS: { kind: LibraryKind; title: string; empty: string }[] = [
  {
    kind: 'user',
    title: 'User presets',
    empty: 'No user presets yet. Presets you store with STORE on the pedal, or rename here, '
      + 'appear here.',
  },
  {
    kind: 'backup',
    title: 'From backup files',
    empty: 'None. Presets from backup files you open appear here until the pedal reports them.',
  },
  {
    kind: 'factory',
    title: 'Factory presets',
    empty: 'No factory presets yet. They appear when you connect the pedal.',
  },
];

/** Factory and user presets are told apart by the artistId the pedal reports. */
export function libraryKind(toneprint: Toneprint): LibraryKind {
  if (toneprint.artistId === FACTORY_ARTIST_ID) return 'factory';
  if (toneprint.artistId === LOCAL_ARTIST_ID) return 'user';
  return 'backup';
}

/** Drag data types: a remembered preset, or a pedal location being moved. */
export const LIBRARY_DRAG_TYPE = 'application/x-delay-librarian-toneprint';
export const LOCATION_DRAG_TYPE = 'application/x-delay-librarian-location';
