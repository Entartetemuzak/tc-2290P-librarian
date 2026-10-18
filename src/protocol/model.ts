import type ByteReader from './ByteReader';
import type ByteWriter from './ByteWriter';

/** A TonePrint: the stored sound of one preset. */
export interface Toneprint {
  id: string;
  name: string;
  /** 71 signed integers; see params.ts for the layout. */
  data: number[];
  artistId: string;
  effectId: number;
}

export interface Effect {
  id: number;
  name: string;
  shortName: string;
  typeName: string;
  defaultToneprintId: string;
}

export interface AllowedValue {
  value: string;
  name: string;
  order: number;
}

export interface Setting {
  key: string;
  value: string;
  type: string;
  unit: string;
  rangeMin: string;
  rangeMax: string;
  descriptionShort: string;
  descriptionLong: string;
  allowedValues: AllowedValue[];
}

export interface SettingsGroup {
  name: string;
  settings: Setting[];
  readonly: boolean;
}

/** Which TonePrint sits on which board and preset slot. */
export interface PresetAssignment {
  group: number;
  /** 1-based board number, 1–64. */
  board: number;
  /** 0 = preset A, 1 = preset B. */
  slot: number;
  toneprintId: string;
}

export interface MidiPcMapping {
  group: number;
  board: number;
  slot: number;
  program: number;
  direction: number;
}

export interface MidiCcRange {
  description: string;
  min: number;
  max: number;
  a: number;
  b: number;
}

export interface MidiCcMapping {
  cc: number;
  action: string;
  values: number[];
  ranges: MidiCcRange[];
  output: string;
}

export function readEffect(r: ByteReader): Effect {
  return {
    id: r.uint(),
    name: r.string(),
    shortName: r.string(),
    typeName: r.string(),
    defaultToneprintId: r.string(),
  };
}

export function readToneprint(r: ByteReader): Toneprint {
  const id = r.string();
  const name = r.string();
  const data = r.vector((rr) => rr.vector((rrr) => rrr.int()));
  const artistId = r.string();
  r.vector((rr) => ({ id: rr.string(), name: rr.string() })); // artists, unused
  const effectId = r.uint();
  r.vector(readEffect); // embedded effects, unused
  return {
    id, name, data: data[0] ?? [], artistId, effectId,
  };
}

export function writeToneprint(w: ByteWriter, toneprint: Toneprint): void {
  w.string(toneprint.id).string(toneprint.name);
  w.vector([toneprint.data], (ww, values) => ww.vector(values, (www, v) => www.int(v)));
  w.string(toneprint.artistId);
  w.vector([], () => undefined);
  w.uint(toneprint.effectId);
  w.vector([], () => undefined);
}

const SETTING_KEYS = [
  'key', 'value', 'type', 'unit', 'rangeMin', 'rangeMax', 'descriptionShort', 'descriptionLong',
] as const;

export function readSetting(r: ByteReader): Setting {
  const strings = SETTING_KEYS.map(() => r.string());
  const allowedValues = r.vector((rr) => ({
    value: rr.string(), name: rr.string(), order: rr.uint(),
  }));
  return {
    key: strings[0] ?? '',
    value: strings[1] ?? '',
    type: strings[2] ?? '',
    unit: strings[3] ?? '',
    rangeMin: strings[4] ?? '',
    rangeMax: strings[5] ?? '',
    descriptionShort: strings[6] ?? '',
    descriptionLong: strings[7] ?? '',
    allowedValues,
  };
}

export function writeSetting(w: ByteWriter, setting: Partial<Setting>): void {
  SETTING_KEYS.forEach((key) => w.string(setting[key] ?? ''));
  w.vector(setting.allowedValues ?? [], (ww, a) => ww.string(a.value).string(a.name).uint(a.order));
}

export function readSettingsGroup(r: ByteReader): SettingsGroup {
  return { name: r.string(), settings: r.vector(readSetting), readonly: r.bool() };
}

export function writeSettingsGroup(
  w: ByteWriter,
  group: { name: string; settings: Partial<Setting>[]; readonly?: boolean },
): void {
  w.string(group.name).vector(group.settings, writeSetting).bool(group.readonly ?? false);
}

export function readAssignment(r: ByteReader): PresetAssignment {
  return {
    group: r.uint(), board: r.uint(), slot: r.uint(), toneprintId: r.string(),
  };
}

export function writeAssignment(w: ByteWriter, a: PresetAssignment): void {
  w.uint(a.group).uint(a.board).uint(a.slot).string(a.toneprintId);
}

export function readPcMapping(r: ByteReader): MidiPcMapping {
  return {
    group: r.uint(), board: r.uint(), slot: r.uint(), program: r.byte(), direction: r.uint(),
  };
}

export function readCcMapping(r: ByteReader): MidiCcMapping {
  const cc = r.int();
  const action = r.string();
  const values = Array.from({ length: 7 }, () => r.int());
  const ranges = r.vector((rr) => ({
    description: rr.string(), min: rr.uint(), max: rr.uint(), a: rr.float(), b: rr.float(),
  }));
  return {
    cc, action, values, ranges, output: r.string(),
  };
}
