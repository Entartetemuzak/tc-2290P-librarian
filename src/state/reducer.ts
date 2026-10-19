import type { PresetAssignment } from '../protocol/model';
import type { Action, AppState } from './types';

const TRAFFIC_LIMIT = 400;

export const initialState: AppState = {
  view: 'presets',
  midiStatus: 'idle',
  midiError: null,
  inputs: [],
  outputs: [],
  inputId: '',
  outputId: '',
  link: 'disconnected',
  version: null,
  assignments: [],
  settings: [],
  pcMap: [],
  ccMap: [],
  toneprints: {},
  current: null,
  liveDelayMs: null,
  lastPing: null,
  backupFile: null,
  selectedIndex: 0,
  details: null,
  traffic: [],
  midiChannel: 1,
  busy: null,
  notice: null,
};

const mergeAssignments = (
  existing: readonly PresetAssignment[],
  changes: readonly PresetAssignment[],
): PresetAssignment[] => {
  const key = (a: PresetAssignment): string => `${a.group}:${a.board}:${a.slot}`;
  const merged = new Map(existing.map((a) => [key(a), a]));
  changes.forEach((a) => merged.set(key(a), a));
  return [...merged.values()];
};

function applyPush(state: AppState, push: Extract<Action, { type: 'push' }>['push']): AppState {
  switch (push.kind) {
    case 'presetSelected':
      return { ...state, current: { board: push.board, slot: push.slot } };
    case 'assignmentsChanged':
      return { ...state, assignments: mergeAssignments(state.assignments, push.assignments) };
    case 'toneprintCreated':
      return {
        ...state,
        toneprints: { ...state.toneprints, [push.toneprint.id]: push.toneprint },
      };
    case 'liveDelay':
      return { ...state, liveDelayMs: push.milliseconds };
    case 'ping':
      return { ...state, lastPing: Date.now() };
    default:
      return state;
  }
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'setView':
      return { ...state, view: action.view };
    case 'midiStatus':
      return { ...state, midiStatus: action.status, midiError: action.error ?? null };
    case 'ports':
      return { ...state, inputs: action.inputs, outputs: action.outputs };
    case 'choosePorts':
      return {
        ...state,
        inputId: action.inputId ?? state.inputId,
        outputId: action.outputId ?? state.outputId,
      };
    case 'link':
      if (action.mode === 'disconnected') {
        return {
          ...state,
          link: 'disconnected',
          version: null,
          assignments: [],
          settings: [],
          pcMap: [],
          ccMap: [],
          current: null,
          liveDelayMs: null,
          lastPing: null,
        };
      }
      return { ...state, link: action.mode };
    case 'pedalData':
      return { ...state, ...action.data };
    case 'toneprints':
      return {
        ...state,
        toneprints: {
          ...state.toneprints,
          ...Object.fromEntries(action.toneprints.map((t) => [t.id, {
            ...t,
            // Backup files do not say whether a preset is factory or user; keep what the
            // pedal reported earlier.
            artistId: t.artistId || state.toneprints[t.id]?.artistId || '',
          }])),
        },
      };
    case 'openDetails':
      return {
        ...state,
        details: action.target,
        selectedIndex: action.target.kind === 'location'
          ? action.target.index
          : state.selectedIndex,
      };
    case 'closeDetails':
      return { ...state, details: null };
    case 'forgetToneprints':
      return { ...state, toneprints: {} };
    case 'push':
      return applyPush(state, action.push);
    case 'backupOpened':
      return { ...state, backupFile: action.file };
    case 'backupClosed':
      return { ...state, backupFile: null };
    case 'select':
      return { ...state, selectedIndex: action.index };
    case 'traffic':
      return { ...state, traffic: [...state.traffic.slice(-(TRAFFIC_LIMIT - 1)), action.entry] };
    case 'clearTraffic':
      return { ...state, traffic: [] };
    case 'setChannel':
      return { ...state, midiChannel: action.channel };
    case 'busy':
      return { ...state, busy: action.label };
    case 'notice':
      return { ...state, notice: action.notice };
    default:
      return state;
  }
}
