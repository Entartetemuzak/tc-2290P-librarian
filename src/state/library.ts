import { FACTORY_ARTIST_ID, LOCAL_ARTIST_ID } from '../protocol/constants';
import type { Toneprint } from '../protocol/model';

export type LibraryKind = 'factory' | 'user' | 'backup';

export const LIBRARY_GROUPS: { kind: LibraryKind; title: string }[] = [
  { kind: 'factory', title: 'Factory presets' },
  { kind: 'user', title: 'User presets' },
  { kind: 'backup', title: 'From backup files' },
];

/** Factory and user presets are told apart by the artistId the pedal reports. */
export function libraryKind(toneprint: Toneprint): LibraryKind {
  if (toneprint.artistId === FACTORY_ARTIST_ID) return 'factory';
  if (toneprint.artistId === LOCAL_ARTIST_ID) return 'user';
  return 'backup';
}

/** MIME type used when a remembered preset is dragged onto a location. */
export const LIBRARY_DRAG_TYPE = 'application/x-delay-librarian-toneprint';
