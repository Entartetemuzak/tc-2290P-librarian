# TC 2290 P — USB-MIDI protocol and backup file format

This document describes how the TC Electronic 2290 P delay pedal communicates over its USB-MIDI
port, and the format of its backup files, as far as needed for interoperability. It is based on
observing MIDI traffic between the official app and a pedal, on backup files, and on what the
official app and the pedal's manual show. It is unofficial and not affiliated with or endorsed
by TC Electronic; "TC Electronic" and "2290 P" are trademarks of their owners.

Nothing here describes how the pedal processes sound.

**Status labels:** *observed* means seen in traffic between the official app and a pedal;
*used* means this project sends it to a real pedal and gets the expected answer.

## 1. Transport

The pedal is a class-compliant USB-MIDI device with a USB-C port. Every message is a SysEx
message:

```
F0 00 20 1F 00 36 <cmd> <7-bit packed payload> F7
```

| Byte | Value | Meaning |
| --- | --- | --- |
| 0 | `F0` | Start of SysEx |
| 1–3 | `00 20 1F` | Manufacturer ID: TC Electronic |
| 4–5 | `00 36` | Product ID of the 2290 P |
| 6 | cmd | SysEx command; `0x68` carries the command protocol below |
| 7… | payload | 7-bit packed |
| last | `F7` | End of SysEx |

The official app also sends `F0 00 20 1F 00 36 05 F7` periodically as a keep-alive. Any reply can
be ignored.

Some USB hosts do not detect the pedal over a USB-C to USB-C cable; a USB-A to USB-C cable (or a
USB-A socket on an adapter) works. The 5-pin MIDI ports accept standard Control Change and Program
Change; whether they carry the command protocol has not been confirmed.

## 2. 7-bit packing

The payload is split into groups of up to seven bytes. Each group is preceded by one byte whose
bit (6 − i) holds bit 7 of group byte i; the group bytes follow with bit 7 cleared. A full group
of seven bytes becomes eight.

Example: `01 7F FF FF` → `18 01 7F 7F 7F`.

## 3. Command protocol

A `0x68` payload is a header followed by a command body. Messages are never split: even
responses of several kilobytes travel in one SysEx message.

### Header

| # | Field | Type | Content |
| --- | --- | --- | --- |
| 1 | commandId | uint | Requests are even; the response is request + 1 |
| 2 | senderId | uint | App 0, pedal 10 |
| 3 | sessionId | uint | Transaction ID: the sender's own counter; a response repeats the request's value |
| 4 | status | uint | See below |
| 5 | sequenceId | uint | Always 0 |
| 6 | (unknown) | uint | Always 1 |
| 7 | flag | byte | Always 1 |

Fields 5–7 are absent when commandId is 4 or 5.

Observed values of field 4: 0 in all requests and most responses; 3 in pings from the pedal; 16
in the pedal's response to a TonePrint upload; `0xFFFFFFFF` in the app's acknowledgements of
settings and live-state pushes. The meaning is unknown and not needed for decoding.

### Encoding

| Type | Encoding |
| --- | --- |
| uint | Variable length, 2-bit size tag in the low bits, little-endian: `v<<2` in 1 byte (v < 2⁶), `(v<<2)\|1` in 2 bytes (v < 2¹⁴), `(v<<2)\|2` in 3 bytes (v < 2²²), otherwise `(v<<2)\|3` in 5 bytes |
| int | Sign-magnitude: `(m<<3)\|(sign<<2)` plus the same size tag; limits 2⁵, 2¹³, 2²¹ |
| string | uint length, then UTF-8 bytes |
| byte, bool | One raw byte |
| float | Four bytes, IEEE-754 little-endian |
| vector | uint count, then the elements |
| Optional | A vector with zero or one element |

### Commands

| Request / response | Purpose | Request body | Response body | Status |
| --- | --- | --- | --- | --- |
| 4 / 5 | Version (discovery) | 5 × uint: `1, 1, 6, 0, 10` | 4 × uint: `1, 1, 6, 0xFFFFFFFF` | observed, used |
| 30 / 31 | TonePrint upload | query + TonePrint | Optional string (the ID) | observed both ways, used |
| 32 / 33 | TonePrint read | query + Optional string | vector of TonePrint | used |
| 52 / 53 | Effect read | query + Optional uint | vector of Effect | observed |
| 92 / 93 | Settings read | query + uint | vector of SettingsGroup | observed, used |
| 94 / 95 | Settings update | query + vector of SettingsGroup | uint | observed both ways, used |
| 102 / 103 | Program Change map read | query + uint | vector of PcMapping | observed, used |
| 112 / 113 | Control Change map read | query + uint | vector of CcMapping | observed, used |
| 1002 / 1003 | Preset locations read | query + uint | vector of Assignment | observed, used |
| 1004 / 1005 | Preset locations update | query + vector of Assignment | uint | observed both ways, used |
| 1012 / 1013 | Live state read | query + Optional uint | (not documented) | observed |
| 1014 / 1015 | Live state push from the pedal | (not documented) | Optional uint | observed |
| 5, status 3 | Ping from the pedal | – | `1, 0, 0, 0` | observed |

Requests the pedal sends on its own (30, 94, 1004, 1014) are acknowledged with the response
command and a single payload byte `00`.

### Queries

Read and write requests start with a query:

1. `table` – string
2. `where` – vector of filters: op byte (0 = where, 1 = and), comparator byte (0 = equals), field
   string, value string
3. `include` – vector of queries (related tables)
4. list A – vector of strings (always empty in observed traffic)
5. list B – vector of strings: the fields a write changes, e.g. `value`

Table names: `toneprint`, `tpData`, `artist`, `effect`, `settingsGroup`, `setting`,
`MidiPCMapping`, `midiCCMapping`, `AssignedToneprint`, `AssignedLiveToneprint`.

The pedal answers incompletely unless the query names what it should return:

| Read | Query |
| --- | --- |
| Settings | `settingsGroup`, where `name` = `""`, include `setting` |
| Program Change map | `MidiPCMapping`, where `direction` = `"0"` (and again with `"1"`) |
| One TonePrint | `toneprint`, where `tpId` = the ID, include `tpData` and `artist` |
| Preset locations, CC map | the table name only |

Selecting the active preset is a settings update: query `settingsGroup` with list B `["value"]`
and an include of `settingsGroup` where `name` = `"SystemState"` (itself including `setting`),
followed by one group `SystemState` with `currentBoard` (1–64) and `currentSlot` (0 = A, 1 = B).

### Data structures

| Structure | Fields in order |
| --- | --- |
| TonePrint | id: string, name: string, data: vector of (vector of int), artistId: string, artists: vector, effectId: uint, effects: vector |
| Assignment | group: uint (0), board: uint (1–64), slot: uint (0 = A, 1 = B), toneprintId: string |
| SettingsGroup | name: string, settings: vector of Setting, readonly: byte |
| Setting | key, value, type, unit, rangeMin, rangeMax, descriptionShort, descriptionLong: strings; allowedValues: vector of (value: string, name: string, order: uint) |
| PcMapping | group: uint, board: uint, slot: uint, program: byte, direction: uint |
| CcMapping | cc: int, action: string, 7 × int, ranges: vector of (description: string, min: uint, max: uint, a: float, b: float), output: string |
| Effect | id: uint, name, shortName, typeName, defaultToneprintId: strings |

Setting values are always text. TonePrint `artistId` is `"1210"` for factory presets and
`"local"` for presets stored on the pedal; the effect ID of the 2290 algorithm is 48012.

Settings groups seen: `ProductSettings` (tempo, bypassMode, exprPedalCalibrationMode,
exprPedalMin, exprPedalMax), `ProductInfo` (serialNumber, softwareVersion and more),
`MidiSettings` (channelIn, channelOut, midiOutFunction, receive, transmit), `SystemState`
(currentBoard, currentSlot, monoStereoMode and more) and `HardwareStatus`.

## 4. Observed message flows

| Event | Messages |
| --- | --- |
| Connect | app 4 → pedal 5; the app then reads 112, 1012, 52, 102 twice, 92 and 1002 |
| Preset selected in the app | app 94 → pedal 95; the pedal pushes the same 94 → app 95 |
| Encoder turned on the pedal | pedal 1014 → app 1015 → pedal ping, once per step |
| STORE on the pedal | pedal 30 (a new TonePrint, named "NO NAME") → app 31 → pedal 1004 (one location) → app 1005 |
| Restore | app 30 for each TonePrint the pedal lacks → pedal 31; then app 1004 with all 128 locations → pedal 1005 |

Every STORE creates a new TonePrint with a new ID.

In a live-state push (1014) the delay time is a 2-byte uint 16 and 15 bytes from the end of the
payload, in units of 0.05 ms. The rest of that structure is not documented here.

## 5. Preset parameters

A preset's data is 71 signed 32-bit integers. Words 0–5 are a header (−1 from the pedal; a zero
and the name in backup files). Parameter word *i* is data[*i* + 6]. Verified against the official
app's parameter pages for several presets and against edits on the pedal.

| Word | Parameter | Encoding |
| --- | --- | --- |
| 0 | constant | 99 |
| 1 | Delay Time | value / 10 = ms |
| 2 | Feedback Level | 0–99 |
| 3 | Feedback Invert | 0/1 |
| 4 | Feedback High Cutoff | Hz |
| 5 | Feedback Low Cutoff | Hz (0 = off) |
| 6 | Delay Level | 0 = off, otherwise (value − 99) / 2 dB |
| 7 | Direct Level | as Delay Level |
| 8 | (unidentified) | 80–99 |
| 9 | Panning Position | 0–99 |
| 10 | Output Invert | 0/1 |
| 11–14 | Delay Mod: Enable, Waveform, Speed, Depth | 0/1; 0 Sine, 1 Rand, 2 Env, 3 Trig; value / 100 = Hz; 0–99 |
| 15–18 | Pan Mod: Enable, Waveform, Speed, Depth | as 11–14 |
| 19–22 | Dyn Mod: Enable, Waveform, Speed, Depth | as 11–14 |
| 23 | Pan Routing | 0 Off, 1 Delay, 2 Direct, 3 Dly+Direct |
| 24 | Dyn Reverse | 0/1 |
| 25 | Delay Mod Invert | 0/1 |
| 26–29 | Delay, Pan and Dyn Mod Threshold; Dyn Mod Fb Threshold | direct |
| 30 | (unidentified) | 0 or 2 |
| 31 | Deep Modulation | 0/1 |
| 32–34 | Sync Enable, Sub division mode, Sub division | 0/1; 0 Straight, 1 Dotted, 2 Triplet; note value 1/2^(6 − value) |
| 35–37, 38–40, 41–43 | Sync for Delay, Pan and Dyn Mod | as 32–34 |
| 44–64 | reserved | identical in all presets |

The pedal stores no tempo in a preset: tapping LEARN with SUB.D on converts the tempo to a delay
time (word 1).

## 6. Backup files (.tc2290B)

JSON with two-space indentation and CRLF line endings:

```
{
  "Content type": "Board presets",
  "Presets": [ { "Name": …, "Id": …, "Preset data": <base64> }, … 128 entries ],
  "CheckSum": <64 lowercase hex characters>
}
```

- Order: 1A, 1B, 2A … 64B.
- `Id` is the TonePrint ID used in Assignments.
- `Preset data` is the 71 words as 32-bit big-endian integers (284 bytes).
- `CheckSum` is HMAC-SHA256 with the key `Key` over the `Presets` array, serialized with the same
  formatting.

## 7. MIDI Control Change map

The default assignment, as shown on the official app's MIDI page. Control Change and Program
Change work over USB and 5-pin MIDI.

| Action | Delay | Pan | Dyn |
| --- | --- | --- | --- |
| Mod Waveform (0–3: Sine, Rand, Env, Trig) | 10 | 20 | 30 |
| Mod Speed (0–127 → 0.1–10 Hz) | 11 | 21 | 31 |
| Mod Depth (0–127 → 0–99 %) | 12 | 22 | 32 |
| Mod Threshold (0–69 → 1–70) | 13 | 23 | 33 |
| Enable Mod | 16 (0 Off, 1 Modulation, 2 Deep) | 26 (0–63 Off, 64–127 On) | 36 (0–63 Off, 64–127 On) |

| CC | Action | Values |
| --- | --- | --- |
| 14 | Delay Time (coarse) | 0–127 → 0–10 s |
| 15 | Invert Delay Mod | 0–63 Off, 64–127 On |
| 24 | Pan Routing | 0 Off, 1 Dly, 2 Direct, 3 Dly + Direct |
| 34 | Dyn Mod Fb Threshold | 0–69 → 1–70 |
| 35 | Dyn Reverse | 0–63 Off, 64–127 On |
| 40 | Feedback Level | 0–127 → 0–99 % |
| 41 | Feedback Invert | 0–63 Off, 64–127 On |
| 42 | Feedback High Cut | 0–127 → 1–20 kHz |
| 43 | Feedback Low Cut | 0–127 → 0–800 Hz |
| 50 | Delay Subdivision | 0 Off, 1–7 1/1–1/64, 8–14 dotted, 15–21 triplet |
| 51–53 | Dly, Pan and Dyn Mod Subdivision | 0 Off, 1–6 1/1–1/32, 7–12 dotted, 13–18 triplet |
| 60–64 | Delay Time, one digit each | 0–9 for 0.1 ms, 1 ms, 10 ms, 100 ms, 1000 ms |
| 70 / 71 | Direct / Delay Level | 0–127 → 0–99 % |
| 73 | Panning Position | 0–127 → 0–99 % |
| 74 | Output Invert | 0–63 Off, 64–127 On |
| 80 / 81 | Board Down / Up | any value |
| 90 / 91 | Slot A / B | 64–127 selects |
| 93 | Tap Tempo | any value |
| 100 | Expression | 0 = heel, 127 = toe |
| 102 | Bypass | 0–63 bypassed, 64–127 engaged |

With the default Program Change map, program n recalls preset n (0 = 1A, 1 = 1B, …).

## 8. Open questions

- The meaning of header field 4 and of list A in queries.
- Preset words 8 and 30.
- The full structure of the live state (1012–1015).
- Whether the 5-pin MIDI ports carry the command protocol.

## Sources

- MIDI traffic between the official app and a 2290 P, captured with a MIDI monitor.
- Backup files made with the official app.
- The official app's preset, MIDI and settings pages.
- [Electori: 2290 P user manual (Japanese)](https://electori.co.jp/tcelectronic/pdf/2290_P_DYNAMIC_DIGITAL_DELAY_manual_jp_REV_1_1.pdf).
