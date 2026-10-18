import type ByteReader from './ByteReader';
import type ByteWriter from './ByteWriter';

export interface WhereFilter {
  /** 0 = where, 1 = andWhere. */
  op: number;
  field: string;
  value: string;
}

/**
 * The query that precedes the parameter of every CRUD request. List B names the
 * fields that a write changes; list A has only been seen empty.
 */
export interface Query {
  table: string;
  where?: WhereFilter[];
  include?: Query[];
  listA?: string[];
  listB?: string[];
}

export function writeQuery(writer: ByteWriter, query: Query): void {
  writer.string(query.table);
  writer.vector(query.where ?? [], (w, filter) => {
    // The comparator byte is always 0 (equals) in the vendor app.
    w.byte(filter.op).byte(0).string(filter.field).string(filter.value);
  });
  writer.vector(query.include ?? [], writeQuery);
  writer.vector(query.listA ?? [], (w, field) => w.string(field));
  writer.vector(query.listB ?? [], (w, field) => w.string(field));
}

export function readQuery(reader: ByteReader): Query {
  const table = reader.string();
  const where = reader.vector((r) => {
    const op = r.byte();
    r.byte(); // comparator
    return { op, field: r.string(), value: r.string() };
  });
  return {
    table,
    where,
    include: reader.vector(readQuery),
    listA: reader.vector((r) => r.string()),
    listB: reader.vector((r) => r.string()),
  };
}

/** Exact table names used by the protocol (note the inconsistent capitalization). */
export const Table = {
  TONEPRINT: 'toneprint',
  EFFECT: 'effect',
  SETTINGS_GROUP: 'settingsGroup',
  SETTING: 'setting',
  MIDI_PC_MAPPING: 'MidiPCMapping',
  MIDI_CC_MAPPING: 'midiCCMapping',
  ASSIGNED_TONEPRINT: 'AssignedToneprint',
  ASSIGNED_LIVE_TONEPRINT: 'AssignedLiveToneprint',
} as const;
