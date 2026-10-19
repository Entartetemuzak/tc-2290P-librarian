import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import ByteReader from './ByteReader';
import ByteWriter from './ByteWriter';
import { CONTROLS, delayTimeDigits } from './ccMap';
import { decodeMessage } from './decode';
import { extractSysExFromText, parseSysEx, toHex } from './frame';
import {
  buildAcknowledgement, buildAssignmentsUpdate, buildPcMapRead, buildSelectPreset,
  buildSettingsRead, buildToneprintRead, buildToneprintSearch, buildVersionRequest,
} from './messages';
import { pack7, unpack7 } from './packing';
import { describeParameters } from './params';
import {
  parseBackup, presetFromToneprint, renamePreset, serializeBackup,
} from './backup';

const hex = (text: string): number[] => text.split(' ').map((h) => Number.parseInt(h, 16));

/* Messages captured between the vendor app and a pedal (no preset content). */
const CAPTURED = {
  versionResponse: 'F0 00 20 1F 00 36 68 00 14 28 24 00 04 04 18 78 7F 7F 7F 7F 03 F7',
  ping: 'F0 00 20 1F 00 36 68 00 14 28 79 08 0C 04 00 00 00 00 F7',
  ackSettings: 'F0 00 20 1F 00 36 68 03 7D 01 00 75 08 7F 7F 60 7F 7F 03 00 04 01 00 F7',
  ackLive: 'F0 00 20 1F 00 36 68 43 5D 0F 00 7D 08 7F 7F 60 7F 7F 03 00 04 01 00 F7',
  ackCreate: 'F0 00 20 1F 00 36 68 00 7C 00 0D 09 00 00 04 00 01 00 F7',
  ackAssigned: 'F0 00 20 1F 00 36 68 40 35 0F 00 15 09 00 00 00 04 01 00 F7',
  selectPreset1B: [
    'F0 00 20 1F 00 36 68 08 79 01 00 0D 04 00 00 00 04 01 34 73 65 74 74 00 69 6E 67 73',
    '47 72 6F 00 75 70 00 04 34 73 65 00 74 74 69 6E 67 73 47 00 72 6F 75 70 04 00 00 00',
    '10 6E 61 6D 65 2C 53 00 79 73 74 65 6D 53 74 00 61 74 65 04 1C 73 65 00 74 74 69 6E',
    '67 00 00 00 00 00 00 00 00 04 14 00 76 61 6C 75 65 04 2C 00 53 79 73 74 65 6D 53 00',
    '74 61 74 65 08 30 63 00 75 72 72 65 6E 74 42 00 6F 61 72 64 04 31 00 00 00 00 00 00',
    '00 00 2C 00 63 75 72 72 65 6E 74 00 53 6C 6F 74 04 31 00 00 00 00 00 00 00 00 00 F7',
  ].join(' '),
};

describe('7-bit packing', () => {
  it('packs the documented example', () => {
    expect(pack7([0x01, 0x7f, 0xff, 0xff])).toEqual([0x18, 0x01, 0x7f, 0x7f, 0x7f]);
  });

  it('round-trips every length up to three groups', () => {
    for (let length = 0; length <= 21; length += 1) {
      const data = Array.from({ length }, (_, i) => (i * 37 + 200) % 256);
      expect(unpack7(pack7(data))).toEqual(data);
    }
  });
});

describe('compact integers', () => {
  it('round-trips unsigned values across all size classes', () => {
    [0, 1, 63, 64, 16383, 16384, 2 ** 22 - 1, 2 ** 22, 0xffffffff].forEach((v) => {
      expect(new ByteReader(new ByteWriter().uint(v).bytes).uint()).toBe(v);
    });
  });

  it('round-trips signed values', () => {
    [0, 1, -1, 31, -32, 8191, -8192, 2 ** 21 - 1, -(2 ** 21), 2 ** 31 - 1].forEach((v) => {
      expect(new ByteReader(new ByteWriter().int(v).bytes).int()).toBe(v);
    });
  });
});

describe('messages', () => {
  it('builds the vendor app discovery probe byte for byte', () => {
    expect(toHex(buildVersionRequest(2)))
      .toBe('F0 00 20 1F 00 36 68 00 10 00 08 00 04 04 18 00 00 28 F7');
  });

  it('builds a preset selection identical to the vendor app', () => {
    expect(toHex(buildSelectPreset(291, 1, 1))).toBe(CAPTURED.selectPreset1B);
  });

  it('acknowledges pedal pushes exactly like the vendor app', () => {
    expect(toHex(buildAcknowledgement(94, 541))).toBe(CAPTURED.ackSettings);
    expect(toHex(buildAcknowledgement(1014, 543))).toBe(CAPTURED.ackLive);
    expect(toHex(buildAcknowledgement(30, 579))).toBe(CAPTURED.ackCreate);
    expect(toHex(buildAcknowledgement(1004, 581))).toBe(CAPTURED.ackAssigned);
  });

  it('round-trips a preset assignment update', () => {
    const assignments = [{
      group: 0, board: 6, slot: 1, toneprintId: '0123456789abcdef0123456789abcdef',
    }];
    const decoded = decodeMessage(buildAssignmentsUpdate(7, assignments));
    expect(decoded?.body).toMatchObject({ assignments });
  });
});

describe('read requests match the vendor app queries', () => {
  it('reads settings with where name = "" and include setting', () => {
    expect(decodeMessage(buildSettingsRead(7))?.body).toEqual({
      query: {
        table: 'settingsGroup',
        where: [{ op: 0, field: 'name', value: '' }],
        include: [{
          table: 'setting', where: [], include: [], listA: [], listB: [],
        }],
        listA: [],
        listB: [],
      },
      parameter: 0,
    });
  });

  it('reads the Program Change map one direction at a time', () => {
    const body = decodeMessage(buildPcMapRead(8, 1))?.body as { query: { where: unknown[] } };
    expect(body.query.where).toEqual([{ op: 0, field: 'direction', value: '1' }]);
  });

  it('asks for every factory preset by artistId', () => {
    const body = decodeMessage(buildToneprintSearch(3, 'artistId', '1210'))?.body as {
      query: { where: unknown[] };
    };
    expect(body.query.where).toEqual([{ op: 0, field: 'artistId', value: '1210' }]);
  });

  it('reads one TonePrint by ID with its data and artist', () => {
    const id = '0123456789abcdef0123456789abcdef';
    const body = decodeMessage(buildToneprintRead(9, id))?.body as {
      query: { table: string; where: unknown[]; include: { table: string }[] };
      parameter: unknown;
    };
    expect(body.query.table).toBe('toneprint');
    expect(body.query.where).toEqual([{ op: 0, field: 'tpId', value: id }]);
    expect(body.query.include.map((q) => q.table)).toEqual(['tpData', 'artist']);
    expect(body.parameter).toBeNull();
  });
});

describe('decoding', () => {
  it('decodes the version response', () => {
    const decoded = decodeMessage(hex(CAPTURED.versionResponse));
    expect(decoded?.header).toMatchObject({ commandId: 5, senderId: 10, sessionId: 9 });
    expect(decoded?.body).toEqual({ fields: [1, 1, 6, 0xffffffff] });
  });

  it('recognizes a ping', () => {
    expect(decodeMessage(hex(CAPTURED.ping))?.isPing).toBe(true);
  });

  it('decodes the settings group in a preset selection', () => {
    const body = decodeMessage(hex(CAPTURED.selectPreset1B))?.body as {
      groups: { name: string; settings: { key: string; value: string }[] }[];
    };
    expect(body.groups[0]?.settings.map((s) => [s.key, s.value]))
      .toEqual([['currentBoard', '1'], ['currentSlot', '1']]);
  });

  it('rejects messages from other manufacturers', () => {
    expect(parseSysEx([0xf0, 0x41, 0x10, 0x00, 0x00, 0x00, 0x00, 0xf7])).toBeNull();
  });

  it('extracts messages and directions from MIDI Monitor log lines', () => {
    const log = `01:00:00.000\tTo 2290P\tSysEx\t\tTC Electronics 19 bytes\t${CAPTURED.ackCreate}\n`
      + `01:00:00.001\tFrom 2290P\tSysEx\t\tTC Electronics 19 bytes\t${CAPTURED.ping}`;
    const found = extractSysExFromText(log);
    expect(found.map((f) => f.direction)).toEqual(['out', 'in']);
    expect(toHex(found[1]?.bytes ?? [])).toBe(CAPTURED.ping);
  });
});

describe('backup files', () => {
  const fixtureUrl = new URL('./__fixtures__/synthetic.tc2290B', import.meta.url);
  const fixture = readFileSync(fixtureUrl, 'utf8');

  it('verifies the checksum and reproduces the file byte for byte', async () => {
    const doc = await parseBackup(fixture);
    expect(doc.checksumValid).toBe(true);
    expect(doc.presets).toHaveLength(128);
    expect(await serializeBackup(doc.presets)).toBe(fixture);
  });

  it('reads parameters with the documented scaling', async () => {
    const doc = await parseBackup(fixture);
    const params = describeParameters(doc.presets[2]?.data ?? []);
    const byName = Object.fromEntries(params.map((p) => [p.name, p.display]));
    expect(byName['Delay Time']).toBe('102.0 ms');
    expect(byName['Delay Level']).toBe('0.0 dB');
    expect(byName['Sub division']).toBe('1/4');
    expect(byName['Dyn Mod Waveform']).toBe('Trig');
  });

  it('renames a preset in both places and gives it a new ID', async () => {
    const doc = await parseBackup(fixture);
    const original = doc.presets[0];
    if (!original) throw new Error('fixture is empty');
    const renamed = renamePreset(original, 'My new name');
    expect(renamed.name).toBe('My new name');
    expect(renamed.id).not.toBe(original.id);
    const again = await parseBackup(await serializeBackup([renamed, ...doc.presets.slice(1)]));
    expect(again.checksumValid).toBe(true);
    expect(again.presets[0]?.name).toBe('My new name');
  });

  it('stores a preset read from the pedal with its name and ID', async () => {
    const doc = await parseBackup(fixture);
    const pedalData = [-1, -1, -1, -1, -1, -1, ...(doc.presets[5]?.data.slice(6) ?? [])];
    const id = 'abcdef0123456789abcdef0123456789';
    const entry = presetFromToneprint({ id, name: 'FROM PEDAL', data: pedalData });
    const again = await parseBackup(await serializeBackup([entry, ...doc.presets.slice(1)]));
    expect(again.presets[0]).toMatchObject({ name: 'FROM PEDAL', id });
    expect(again.presets[0]?.data.slice(6)).toEqual(doc.presets[5]?.data.slice(6));
  });

  it('rejects files that are not backups', async () => {
    await expect(parseBackup('{"hello":1}')).rejects.toThrow(/preset list/);
  });
});

describe('MIDI CC helpers', () => {
  it('starts live controls at the stored preset values', async () => {
    const fixtureUrl = new URL('./__fixtures__/synthetic.tc2290B', import.meta.url);
    const data = (await parseBackup(readFileSync(fixtureUrl, 'utf8'))).presets[2]?.data ?? [];
    const cc = (n: number): number | undefined => (
      CONTROLS.find((c) => c.cc === n)?.fromPreset?.(data)
    );
    expect(cc(40)).toBe(3); // feedback 2 of 99
    expect(cc(11)).toBe(12); // delay mod speed 1.02 Hz
    expect(cc(13)).toBe(9); // delay mod threshold 10
    expect(cc(16)).toBe(1); // delay mod on, deep off
    expect(cc(50)).toBe(0); // sync off
  });

  it('splits a delay time into the five digit controllers', () => {
    expect(delayTimeDigits(1234.5)).toEqual([
      { cc: 64, value: 1 }, { cc: 63, value: 2 }, { cc: 62, value: 3 },
      { cc: 61, value: 4 }, { cc: 60, value: 5 },
    ]);
  });
});
