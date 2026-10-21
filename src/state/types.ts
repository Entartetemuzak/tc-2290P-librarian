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

/** A preset location (0–127) or a remembered preset (TonePrint ID). */
export type DetailsTarget = { kind: 'location'; index: number } | { kind: 'library'; id: string };

/** A backup file opened for restoring to the pedal. */
export interface BackupFileState {
  fileName: string;
  presets: LibraryPreset[];
  checksumValid: boolean;
}

export interface Notice {
  tone: 'info' | 'error';
  text: string;
}

export interface AppState {
  view: ViewId;
  midiStatus: MidiStatus;
  midiError: string | null;
  /** What the browser's Web MIDI provides, shown for troubleshooting. */
  midiDebug: string;
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
  backupFile: BackupFileState | null;
  selectedIndex: number;
  /** What the details dialog shows, if it is open. */
  details: DetailsTarget | null;
  traffic: TrafficEntry[];
  midiChannel: number;
  busy: string | null;
  notice: Notice | null;
}

export type PedalData = Partial<Pick<AppState,
'assignments' | 'settings' | 'pcMap' | 'ccMap' | 'version'>>;

export type Action = { type: 'setView'; view: ViewId }
  | { type: 'midiStatus'; status: MidiStatus; error?: string | null }
  | { type: 'ports'; inputs: PortInfo[]; outputs: PortInfo[] }
  | { type: 'midiDebug'; text: string }
  | { type: 'choosePorts'; inputId?: string; outputId?: string }
  | { type: 'link'; mode: LinkMode }
  | { type: 'pedalData'; data: PedalData }
  | { type: 'toneprints'; toneprints: Toneprint[] }
  | { type: 'forgetToneprints' }
  | { type: 'openDetails'; target: DetailsTarget }
  | { type: 'closeDetails' }
  | { type: 'push'; push: PedalPush }
  | { type: 'backupOpened'; file: BackupFileState }
  | { type: 'backupClosed' }
  | { type: 'select'; index: number }
  | { type: 'traffic'; entry: TrafficEntry }
  | { type: 'clearTraffic' }
  | { type: 'setChannel'; channel: number }
  | { type: 'busy'; label: string | null }
  | { type: 'notice'; notice: Notice | null };
