# Delay Librarian

An unofficial, browser-based librarian for the TC Electronic 2290 P delay pedal. It runs
entirely in the browser with Web MIDI: no installation, no server, and no data leaves your
computer.

> **Not affiliated with or endorsed by TC Electronic or Music Tribe.** "TC Electronic" and
> "2290 P" are trademarks of their owners and are used only to describe compatibility. This
> project contains no code, images, fonts, presets or other material from the official app or
> the pedal. The interface is an original design built with CSS only.

## What it does

| Area | Over USB (SysEx) | Over 5-pin MIDI |
| --- | --- | --- |
| Show the 128 preset locations (boards 1–64, presets A/B) | Yes | – |
| Recall a preset | Yes | Yes, with Program Change (default map) |
| Live control of every parameter with MIDI CC | Yes | Yes |
| Exact delay time (CC 60–64) | Yes | Yes |
| Live delay time reported by the pedal | Yes | – |
| Read MIDI setup and pedal settings | Yes | – |
| Open, rename, rearrange and save backup files (.tc2290B) | Works offline | Works offline |
| SysEx monitor with decoding | Yes | MIDI messages only |
| Write a backup to the pedal (experimental) | Yes | – |

Backup files saved here carry a valid checksum, so the official app's **Restore Backup**
accepts them. Renamed presets get a new TonePrint ID, so a restore uploads them instead of
keeping the old version on the pedal.

## Browser support

Web MIDI with SysEx is required.

- **Chrome, Edge, Opera (desktop):** supported. The browser asks for MIDI permission.
- **Firefox:** supported; the first visit installs a site permission add-on.
- **Safari:** not supported (no Web MIDI).

Web MIDI only works on HTTPS or `localhost`. GitHub Pages serves HTTPS.

## Connecting

- **USB:** the pedal is a class-compliant USB-MIDI device and appears as a normal MIDI port.
  Choose it as input and output and select **Connect**. If the pedal answers the SysEx
  handshake, all librarian functions are available.
- **5-pin MIDI:** connect a MIDI interface to the pedal's MIDI IN (and OUT, if you want to
  monitor). The handshake gets no answer, so the app switches to *MIDI control only*: Control
  Change and Program Change work; librarian functions do not. Set the MIDI channel on the Live
  control page to the pedal's Channel In.

## Development

Requirements: Node.js 22 or later and [pnpm](https://pnpm.io) 12 (`corepack enable` sets it
up from `packageManager` in `package.json`).

```sh
pnpm install
pnpm dev        # start the dev server on http://localhost:5173
pnpm check      # type check, lint and test
pnpm build      # production build in dist/
```

`pnpm-workspace.yaml` allows the install script of `unrs-resolver`, which the lint setup uses;
pnpm blocks install scripts unless they are listed there.

## Deploying to GitHub Pages

1. Push the repository to GitHub.
2. In **Settings → Pages**, set **Source** to **GitHub Actions**.
3. Push to `main`. The workflow in `.github/workflows/deploy.yml` type checks, lints, tests,
   builds with the base path `/<repository name>/` and publishes the site.

Pull requests run the same checks without deploying.

## Tech stack and code standard

- React 19.3, TypeScript 6.0, Vite 8, Vitest 5, pnpm 12.
- Airbnb JavaScript and React style through
  [`eslint-config-airbnb-extended`](https://www.npmjs.com/package/eslint-config-airbnb-extended),
  the maintained flat-config port of the Airbnb rules with TypeScript support, on ESLint 9.
  The original `eslint-config-airbnb` stops at ESLint 8.
- TypeScript stays on 6.0 because `typescript-eslint` does not support TypeScript 7 yet.

## Project structure

```
src/
  protocol/   Pure TypeScript: SysEx framing, 7-bit packing, the command protocol,
              parameter map, backup file format, MIDI CC map. Fully unit tested.
  midi/       Web MIDI access and DeviceLink (request/response, acknowledgements).
  state/      App state (reducer + context) and the provider that owns the MIDI link.
  components/ Shared UI parts.
  views/      Presets, Live control, Backup files, MIDI setup, Pedal settings, SysEx monitor.
  styles/     The CSS design system.
```

## How the protocol works, briefly

The pedal speaks a request/response protocol inside SysEx messages
`F0 00 20 1F 00 36 68 … F7` (TC Electronic manufacturer ID, product 0x0036, command 0x68).
Payloads are 7-bit packed and use compact variable-length integers. Presets are TonePrints:
71 integers of parameter data, the same data stored base64-encoded in backup files. Backup
files are JSON signed with HMAC-SHA256. The tests in `src/protocol/protocol.test.ts` check the
encoders byte for byte against messages captured from the official app.

## Safety

Read-only functions and live control are safe. Writing to the pedal (preset selection is the
only write that is always on; the rest is behind *Enable experimental functions*) changes its
contents. Take a backup with the official app before you write anything.

## License

MIT. See [LICENSE](LICENSE).
