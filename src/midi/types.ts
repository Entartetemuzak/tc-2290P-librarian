import type { PresetAssignment, Toneprint } from '../protocol/model';

export type Direction = 'in' | 'out';

export interface TrafficEntry {
  id: number;
  time: number;
  direction: Direction;
  bytes: number[];
}

/** Something the pedal told us on its own, without a request from this app. */
export type PedalPush = { kind: 'presetSelected'; board: number; slot: number }
  | { kind: 'assignmentsChanged'; assignments: PresetAssignment[] }
  | { kind: 'toneprintCreated'; toneprint: Toneprint }
  | { kind: 'liveDelay'; milliseconds: number }
  | { kind: 'ping' };

export interface LinkListener {
  onTraffic: (entry: TrafficEntry) => void;
  onPush: (push: PedalPush) => void;
}
