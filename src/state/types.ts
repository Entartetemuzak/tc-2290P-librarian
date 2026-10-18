import type { PortInfo } from '../midi/webMidi';
import type { PedalPush, TrafficEntry } from '../midi/types';
import type { LibraryPreset } from '../protocol/backup';
import type {
  MidiCcMapping, MidiPcMapping, PresetAssignment, SettingsGroup, Toneprint,
} from '../protocol/model';

export type MidiStatus = 'unsupported' | 'idle' | 'requesting' | 'ready' | 'error';

/**
 * librarian = a 2290 P answered over SysEx (USB); controlOnly = the ports work
 * but nothing answered, so only MIDI CC/PC are sent (e.g. 5-pin MIDI).
 */
export type LinkMode = 'disconnected' | 'connecting' | 'librarian' | 'controlOnly';

export type ViewId = 'presets' | 'live' | 'midi' | 'settings' | 'backup' | 'monitor';

export type PresetSource = 'pedal' | 'library';

export interface LibraryState {
  fileName: string;
  presets: LibraryPreset[];
  checksumValid: boolean;
  modified: boolean;
}

export interface Notice {
  tone: 'info' | 'error';
  text: string;
}

export interface AppState {
  view: ViewId;
  midiStatus: MidiStatus;
  midiError: string | null;
  inputs: PortInfo[];
  outputs: PortInfo[];
  inputId: string;
  outputId: string;
  link: LinkMode;
  version: number[] | null;
  assignments: PresetAssignment[];
  settings: SettingsGroup[];
  pcMap: MidiPcMapping[];
  ccMap: MidiCcMapping[];
  toneprints: Record<string, Toneprint>;
  current: { board: number; slot: number } | null;
  liveDelayMs: number | null;
  lastPing: number | null;
  library: LibraryState | null;
  source: PresetSource;
  selectedIndex: number;
  traffic: TrafficEntry[];
  midiChannel: number;
  experimental: boolean;
  busy: string | null;
  notice: Notice | null;
}

export type PedalData = Partial<Pick<AppState,
'assignments' | 'settings' | 'pcMap' | 'ccMap' | 'version'>>;

export type Action = { type: 'setView'; view: ViewId }
  | { type: 'midiStatus'; status: MidiStatus; error?: string | null }
  | { type: 'ports'; inputs: PortInfo[]; outputs: PortInfo[] }
  | { type: 'choosePorts'; inputId?: string; outputId?: string }
  | { type: 'link'; mode: LinkMode }
  | { type: 'pedalData'; data: PedalData }
  | { type: 'toneprints'; toneprints: Toneprint[] }
  | { type: 'push'; push: PedalPush }
  | { type: 'libraryLoaded'; library: LibraryState }
  | { type: 'libraryChanged'; presets: LibraryState['presets'] }
  | { type: 'librarySaved' }
  | { type: 'libraryClosed' }
  | { type: 'setSource'; source: PresetSource }
  | { type: 'select'; index: number }
  | { type: 'traffic'; entry: TrafficEntry }
  | { type: 'clearTraffic' }
  | { type: 'setChannel'; channel: number }
  | { type: 'setExperimental'; enabled: boolean }
  | { type: 'busy'; label: string | null }
  | { type: 'notice'; notice: Notice | null };
