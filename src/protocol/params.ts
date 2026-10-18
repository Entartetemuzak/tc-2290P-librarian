/**
 * Layout of a preset's TonePrint data: 71 signed 32-bit integers. Words 0–5 are
 * a header (the preset name in backup files); parameter word i is data[i + 6].
 */
export const HEADER_WORDS = 6;
export const DATA_WORDS = 71;

export type ParameterKind = 'ms' | 'hz' | 'hertz' | 'number' | 'toggle' | 'waveform'
  | 'routing' | 'subdivisionMode' | 'subdivision' | 'level' | 'hidden';

export interface ParameterDefinition {
  word: number;
  name: string;
  section: string;
  kind: ParameterKind;
}

const WAVEFORMS = ['Sine', 'Rand', 'Env', 'Trig'];
const ROUTINGS = ['Off', 'Delay', 'Direct', 'Dly+Direct'];
const SUBDIVISION_MODES = ['Straight', 'Dotted', 'Triplet'];

const modSection = (base: number, prefix: string, section: string): ParameterDefinition[] => [
  {
    word: base, name: `Enable ${prefix} Mod`, section, kind: 'toggle',
  },
  {
    word: base + 1, name: `${prefix} Mod Waveform`, section, kind: 'waveform',
  },
  {
    word: base + 2, name: `${prefix} Mod Speed`, section, kind: 'hz',
  },
  {
    word: base + 3, name: `${prefix} Mod Depth`, section, kind: 'number',
  },
];

const syncSection = (base: number, prefix: string, section: string): ParameterDefinition[] => [
  {
    word: base, name: `${prefix} Sync Enable`.trim(), section, kind: 'toggle',
  },
  {
    word: base + 1, name: `${prefix} Sub division mode`.trim(), section, kind: 'subdivisionMode',
  },
  {
    word: base + 2, name: `${prefix} Sub division`.trim(), section, kind: 'subdivision',
  },
];

export const PARAMETERS: readonly ParameterDefinition[] = [
  {
    word: 1, name: 'Delay Time', section: 'Delay', kind: 'ms',
  },
  {
    word: 2, name: 'Feedback Level', section: 'Feedback', kind: 'number',
  },
  {
    word: 3, name: 'Feedback Invert', section: 'Feedback', kind: 'toggle',
  },
  {
    word: 4, name: 'Feedback High Cutoff', section: 'Feedback', kind: 'hertz',
  },
  {
    word: 5, name: 'Feedback Low Cutoff', section: 'Feedback', kind: 'hertz',
  },
  {
    word: 6, name: 'Delay Level', section: 'Output', kind: 'level',
  },
  {
    word: 7, name: 'Direct Level', section: 'Output', kind: 'level',
  },
  {
    word: 9, name: 'Panning Position', section: 'Output', kind: 'number',
  },
  {
    word: 10, name: 'Output Invert', section: 'Output', kind: 'toggle',
  },
  {
    word: 23, name: 'Pan Routing', section: 'Output', kind: 'routing',
  },
  ...modSection(11, 'Delay', 'Delay modulation'),
  {
    word: 25, name: 'Delay Mod Invert', section: 'Delay modulation', kind: 'toggle',
  },
  {
    word: 31, name: 'Deep Modulation', section: 'Delay modulation', kind: 'toggle',
  },
  {
    word: 26, name: 'Delay Mod Threshold', section: 'Delay modulation', kind: 'number',
  },
  ...modSection(15, 'Pan', 'Pan modulation'),
  {
    word: 27, name: 'Pan Mod Threshold', section: 'Pan modulation', kind: 'number',
  },
  ...modSection(19, 'Dyn', 'Dynamic modulation'),
  {
    word: 28, name: 'Dyn Mod Threshold', section: 'Dynamic modulation', kind: 'number',
  },
  {
    word: 29, name: 'Dyn Mod Fb Threshold', section: 'Dynamic modulation', kind: 'number',
  },
  {
    word: 24, name: 'Dyn Reverse', section: 'Dynamic modulation', kind: 'toggle',
  },
  ...syncSection(32, '', 'Tempo sync'),
  ...syncSection(35, 'Dly Mod', 'Tempo sync'),
  ...syncSection(38, 'Pan Mod', 'Tempo sync'),
  ...syncSection(41, 'Dyn Mod', 'Tempo sync'),
  {
    word: 8, name: 'Hidden word 8 (probably master level)', section: 'Hidden', kind: 'hidden',
  },
  {
    word: 30, name: 'Hidden word 30', section: 'Hidden', kind: 'hidden',
  },
];

export function formatParameter(kind: ParameterKind, raw: number): string {
  switch (kind) {
    case 'ms': return `${(raw / 10).toFixed(1)} ms`;
    case 'hz': return `${(raw / 100).toFixed(2)} Hz`;
    case 'hertz': return `${raw} Hz`;
    case 'toggle': return raw ? 'On' : 'Off';
    case 'waveform': return WAVEFORMS[raw] ?? String(raw);
    case 'routing': return ROUTINGS[raw] ?? String(raw);
    case 'subdivisionMode': return SUBDIVISION_MODES[raw] ?? String(raw);
    case 'subdivision': return `1/${2 ** (6 - raw)}`;
    case 'level': return raw === 0 ? 'Off' : `${((raw - 99) / 2).toFixed(1)} dB`;
    default: return String(raw);
  }
}

/** Parameter word i of a 71-word TonePrint data vector. */
export const parameterWord = (data: readonly number[], word: number): number => (
  data[HEADER_WORDS + word] ?? 0
);

export interface FormattedParameter extends ParameterDefinition {
  raw: number;
  display: string;
}

export function describeParameters(data: readonly number[]): FormattedParameter[] {
  return PARAMETERS.map((p) => {
    const raw = parameterWord(data, p.word);
    return { ...p, raw, display: formatParameter(p.kind, raw) };
  });
}
