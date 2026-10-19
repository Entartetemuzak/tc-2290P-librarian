import { parameterWord } from './params';

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
  /** The CC value matching a preset's stored setting (TonePrint data, 71 words). */
  fromPreset?: (data: readonly number[]) => number;
}

type Data = readonly number[];

const clampCc = (value: number, max = 127): number => (
  Math.min(max, Math.max(0, Math.round(value)))
);
const word = (data: Data, index: number): number => parameterWord(data, index);
/** 0–99 stored → 0–127 CC */
const percentCc = (index: number) => (d: Data): number => clampCc((word(d, index) * 127) / 99);
/** Hz × 100 stored → 0.1–10 Hz over 0–127 */
const speedCc = (index: number) => (d: Data): number => (
  clampCc(((word(d, index) / 100 - 0.1) / 9.9) * 127)
);
/** threshold 1–70 stored → CC 0–69 */
const thresholdCc = (index: number) => (d: Data): number => clampCc(word(d, index) - 1, 69);
const directCc = (index: number) => (d: Data): number => clampCc(word(d, index));
const toggleCc = (index: number) => (d: Data): number => (word(d, index) ? 127 : 0);
/** Sync enable, mode and note value combined into one subdivision CC value. */
const subdivisionCc = (base: number, perMode: number) => (d: Data): number => {
  if (!word(d, base)) return 0;
  return 1 + word(d, base + 1) * perMode + (6 - word(d, base + 2));
};

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

/** CC numbers and preset words for one modulation section. */
interface ModulationWords {
  cc: number;
  subdivisionCc: number;
  /** Word of "Enable … Mod"; waveform, speed and depth follow it. */
  enableWord: number;
  thresholdWord: number;
  syncWord: number;
}

const modulation = (
  section: string,
  words: ModulationWords,
  enable: ControlDefinition,
): ControlDefinition[] => [
  enable,
  {
    cc: words.cc,
    label: 'Waveform',
    section,
    kind: 'choice',
    options: WAVEFORMS,
    fromPreset: directCc(words.enableWord + 1),
  },
  {
    cc: words.cc + 1,
    label: 'Speed',
    section,
    kind: 'range',
    max: 127,
    display: speed,
    fromPreset: speedCc(words.enableWord + 2),
  },
  {
    cc: words.cc + 2,
    label: 'Depth',
    section,
    kind: 'range',
    max: 127,
    display: percent,
    fromPreset: percentCc(words.enableWord + 3),
  },
  {
    cc: words.cc + 3,
    label: 'Threshold',
    section,
    kind: 'range',
    max: 69,
    display: threshold,
    fromPreset: thresholdCc(words.thresholdWord),
  },
  {
    cc: words.subdivisionCc,
    label: 'Subdivision',
    section,
    kind: 'choice',
    options: noteValues(6),
    fromPreset: subdivisionCc(words.syncWord, 6),
  },
];

const toggle = (
  cc: number,
  label: string,
  section: string,
  fromPreset?: (data: Data) => number,
): ControlDefinition => ({
  cc, label, section, kind: 'toggle', offValue: 0, onValue: 127, fromPreset,
});

export const CONTROLS: readonly ControlDefinition[] = [
  {
    cc: 14,
    label: 'Delay Time (coarse)',
    section: 'Delay',
    kind: 'range',
    max: 127,
    display: (v) => `${(scale(v, 0, 10)).toFixed(2)} s`,
    fromPreset: (d) => clampCc((word(d, 1) / 10 / 10000) * 127),
  },
  {
    cc: 50,
    label: 'Subdivision',
    section: 'Delay',
    kind: 'choice',
    options: noteValues(7),
    fromPreset: subdivisionCc(32, 7),
  },
  {
    cc: 40,
    label: 'Feedback Level',
    section: 'Feedback',
    kind: 'range',
    max: 127,
    display: percent,
    fromPreset: percentCc(2),
  },
  toggle(41, 'Feedback Invert', 'Feedback', toggleCc(3)),
  {
    cc: 42,
    label: 'High Cut',
    section: 'Feedback',
    kind: 'range',
    max: 127,
    display: (v) => `${scale(v, 1, 20).toFixed(1)} kHz`,
    fromPreset: (d) => clampCc(((word(d, 4) / 1000 - 1) / 19) * 127),
  },
  {
    cc: 43,
    label: 'Low Cut',
    section: 'Feedback',
    kind: 'range',
    max: 127,
    display: (v) => `${Math.round(scale(v, 0, 800))} Hz`,
    fromPreset: (d) => clampCc((word(d, 5) / 800) * 127),
  },
  {
    cc: 71,
    label: 'Delay Level',
    section: 'Output',
    kind: 'range',
    max: 127,
    display: percent,
    fromPreset: percentCc(6),
  },
  {
    cc: 70,
    label: 'Direct Level',
    section: 'Output',
    kind: 'range',
    max: 127,
    display: percent,
    fromPreset: percentCc(7),
  },
  {
    cc: 73,
    label: 'Panning',
    section: 'Output',
    kind: 'range',
    max: 127,
    display: percent,
    fromPreset: percentCc(9),
  },
  {
    cc: 24,
    label: 'Pan Routing',
    section: 'Output',
    kind: 'choice',
    options: ['Off', 'Dly', 'Direct', 'Dly + Direct'],
    fromPreset: directCc(23),
  },
  toggle(74, 'Output Invert', 'Output', toggleCc(10)),
  ...modulation('Delay modulation', {
    cc: 10, subdivisionCc: 51, enableWord: 11, thresholdWord: 26, syncWord: 35,
  }, {
    cc: 16,
    label: 'Enable',
    section: 'Delay modulation',
    kind: 'choice',
    options: ['Off', 'Modulation', 'Deep Modulation'],
    fromPreset: (d) => {
      if (!word(d, 11)) return 0;
      return word(d, 31) ? 2 : 1;
    },
  }),
  toggle(15, 'Invert', 'Delay modulation', toggleCc(25)),
  ...modulation('Pan modulation', {
    cc: 20, subdivisionCc: 52, enableWord: 15, thresholdWord: 27, syncWord: 38,
  }, toggle(26, 'Enable', 'Pan modulation', toggleCc(15))),
  ...modulation('Dynamic modulation', {
    cc: 30, subdivisionCc: 53, enableWord: 19, thresholdWord: 28, syncWord: 41,
  }, toggle(36, 'Enable', 'Dynamic modulation', toggleCc(19))),
  {
    cc: 34,
    label: 'Fb Threshold',
    section: 'Dynamic modulation',
    kind: 'range',
    max: 69,
    display: threshold,
    fromPreset: thresholdCc(29),
  },
  toggle(35, 'Reverse', 'Dynamic modulation', toggleCc(24)),
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
