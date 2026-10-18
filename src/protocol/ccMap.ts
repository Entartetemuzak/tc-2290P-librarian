/**
 * The pedal's default MIDI CC assignment, as listed on the vendor app's MIDI
 * page. Control Change works over USB and over 5-pin MIDI.
 */
export type ControlKind = 'range' | 'toggle' | 'choice' | 'trigger';

export interface ControlDefinition {
  cc: number;
  label: string;
  section: string;
  kind: ControlKind;
  /** For ranges: the highest CC value the pedal uses. */
  max?: number;
  /** For ranges: how to show the value. */
  display?: (value: number) => string;
  /** For choices: one label per CC value, starting at 0. */
  options?: string[];
  /** For toggles: the CC values for off and on. */
  offValue?: number;
  onValue?: number;
}

const scale = (value: number, from: number, to: number, max = 127): number => (
  from + ((to - from) * value) / max
);
const percent = (value: number): string => `${Math.round(scale(value, 0, 99))} %`;
const speed = (value: number): string => `${scale(value, 0.1, 10).toFixed(2)} Hz`;
const threshold = (value: number): string => `${value + 1}`;

const WAVEFORMS = ['Sine', 'Rand', 'Env', 'Trig'];

const noteValues = (deepest: number): string[] => {
  const straight = Array.from({ length: deepest }, (_, i) => `1/${2 ** i}`);
  return [
    'Off',
    ...straight,
    ...straight.map((n) => `.${n}`),
    ...straight.map((n) => `t${n}`),
  ];
};

const modulation = (
  section: string,
  base: number,
  enable: ControlDefinition,
  subdivisionCc: number,
): ControlDefinition[] => [
  enable,
  {
    cc: base, label: 'Waveform', section, kind: 'choice', options: WAVEFORMS,
  },
  {
    cc: base + 1, label: 'Speed', section, kind: 'range', max: 127, display: speed,
  },
  {
    cc: base + 2, label: 'Depth', section, kind: 'range', max: 127, display: percent,
  },
  {
    cc: base + 3, label: 'Threshold', section, kind: 'range', max: 69, display: threshold,
  },
  {
    cc: subdivisionCc, label: 'Subdivision', section, kind: 'choice', options: noteValues(6),
  },
];

const toggle = (cc: number, label: string, section: string): ControlDefinition => ({
  cc, label, section, kind: 'toggle', offValue: 0, onValue: 127,
});

export const CONTROLS: readonly ControlDefinition[] = [
  {
    cc: 14,
    label: 'Delay Time (coarse)',
    section: 'Delay',
    kind: 'range',
    max: 127,
    display: (v) => `${(scale(v, 0, 10)).toFixed(2)} s`,
  },
  {
    cc: 50, label: 'Subdivision', section: 'Delay', kind: 'choice', options: noteValues(7),
  },
  {
    cc: 40, label: 'Feedback Level', section: 'Feedback', kind: 'range', max: 127, display: percent,
  },
  toggle(41, 'Feedback Invert', 'Feedback'),
  {
    cc: 42,
    label: 'High Cut',
    section: 'Feedback',
    kind: 'range',
    max: 127,
    display: (v) => `${scale(v, 1, 20).toFixed(1)} kHz`,
  },
  {
    cc: 43,
    label: 'Low Cut',
    section: 'Feedback',
    kind: 'range',
    max: 127,
    display: (v) => `${Math.round(scale(v, 0, 800))} Hz`,
  },
  {
    cc: 71, label: 'Delay Level', section: 'Output', kind: 'range', max: 127, display: percent,
  },
  {
    cc: 70, label: 'Direct Level', section: 'Output', kind: 'range', max: 127, display: percent,
  },
  {
    cc: 73, label: 'Panning', section: 'Output', kind: 'range', max: 127, display: percent,
  },
  {
    cc: 24,
    label: 'Pan Routing',
    section: 'Output',
    kind: 'choice',
    options: ['Off', 'Dly', 'Direct', 'Dly + Direct'],
  },
  toggle(74, 'Output Invert', 'Output'),
  ...modulation('Delay modulation', 10, {
    cc: 16,
    label: 'Enable',
    section: 'Delay modulation',
    kind: 'choice',
    options: ['Off', 'Modulation', 'Deep Modulation'],
  }, 51),
  toggle(15, 'Invert', 'Delay modulation'),
  ...modulation('Pan modulation', 20, toggle(26, 'Enable', 'Pan modulation'), 52),
  ...modulation('Dynamic modulation', 30, toggle(36, 'Enable', 'Dynamic modulation'), 53),
  {
    cc: 34,
    label: 'Fb Threshold',
    section: 'Dynamic modulation',
    kind: 'range',
    max: 69,
    display: threshold,
  },
  toggle(35, 'Reverse', 'Dynamic modulation'),
];

export const PEDAL_ACTIONS = {
  boardDown: 80,
  boardUp: 81,
  slotA: 90,
  slotB: 91,
  tapTempo: 93,
  expression: 100,
  bypass: 102,
} as const;

/** CC 60–64 set the delay time one decimal digit at a time (0.1 ms … 1000 ms). */
export function delayTimeDigits(milliseconds: number): { cc: number; value: number }[] {
  const tenths = Math.round(Math.min(Math.max(milliseconds, 0), 9999.9) * 10);
  return [64, 63, 62, 61, 60].map((cc, i) => ({
    cc,
    value: Math.floor(tenths / 10 ** (4 - i)) % 10,
  }));
}
