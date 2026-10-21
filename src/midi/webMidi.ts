export interface PortInfo {
  id: string;
  name: string;
  manufacturer: string;
  connected: boolean;
}

/*
 * Some browsers provide Web MIDI through an injected stand-in (for example
 * iOS apps that add MIDI to a web view). Those often implement only part of
 * the standard API, so everything here sticks to the most widely supported
 * parts: callback properties, forEach on port maps, and plain arrays for data.
 */

export const isWebMidiSupported = (): boolean => (
  typeof navigator !== 'undefined' && typeof navigator.requestMIDIAccess === 'function'
);

const describeError = (error: unknown): string => {
  if (error && typeof error === 'object') {
    const e = error as { name?: unknown; message?: unknown };
    return `${String(e.name ?? 'Error')}: ${String(e.message ?? '')}`;
  }
  return `threw ${typeof error}: ${String(error)}`;
};

/** Settles with null if the promise does not settle in time (some implementations never do). */
function withTimeout<T>(promise: PromiseLike<T>, ms: number): Promise<T | null> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve(null), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

const ACCESS_OPTIONS: { label: string; options: MIDIOptions | undefined; sysex: boolean }[] = [
  { label: '{ sysex: true }', options: { sysex: true }, sysex: true },
  { label: '{ sysex: false }', options: { sysex: false }, sysex: false },
  { label: '(no options)', options: undefined, sysex: false },
];

/**
 * Asks for MIDI with SysEx, which the librarian needs. If that fails, asks again without
 * SysEx, so live control and Program Change still work. Each attempt and its outcome is
 * added to the log, for troubleshooting.
 */
export async function requestMidiAccess(
  log: string[],
): Promise<{ access: MIDIAccess; sysex: boolean }> {
  if (!isWebMidiSupported()) {
    throw new Error('This browser has no Web MIDI. Use Chrome, Edge, Opera or Firefox, '
      + 'or on iOS an app that adds Web MIDI to its browser.');
  }
  for (let i = 0; i < ACCESS_OPTIONS.length; i += 1) {
    const attempt = ACCESS_OPTIONS[i];
    if (attempt) {
      try {
        const result: unknown = attempt.options
          ? navigator.requestMIDIAccess(attempt.options)
          : navigator.requestMIDIAccess();
        if (!result || typeof (result as PromiseLike<unknown>).then !== 'function') {
          log.push(`${attempt.label}: returned ${typeof result}, not a promise`);
        } else {
          // Each attempt must finish before the next one starts.
          // eslint-disable-next-line no-await-in-loop
          const access = await withTimeout(result as PromiseLike<MIDIAccess>, 8000);
          if (access) {
            log.push(`${attempt.label}: granted`);
            return { access, sysex: attempt.sysex && access.sysexEnabled !== false };
          }
          log.push(`${attempt.label}: no answer within 8 seconds`);
        }
      } catch (error) {
        log.push(`${attempt.label}: ${describeError(error)}`);
      }
    }
  }
  throw new Error('The browser refused MIDI access. Open MIDI details for what happened.');
}

interface PortMapLike {
  forEach?: (callback: (port: MIDIPort) => void) => void;
  values?: () => Iterable<MIDIPort>;
}

/** Reads a port map whether it is a real Map, a Map-like object or a plain object. */
function collectPorts(map: unknown): MIDIPort[] {
  if (!map || typeof map !== 'object') return [];
  const ports: MIDIPort[] = [];
  const like = map as PortMapLike;
  if (typeof like.forEach === 'function') {
    like.forEach((port) => ports.push(port));
  } else if (typeof like.values === 'function') {
    ports.push(...Array.from(like.values()));
  } else {
    ports.push(...(Object.values(map) as MIDIPort[]));
  }
  // Some implementations use numeric port IDs; accept anything that identifies the port.
  return ports.filter((p) => p && p.id !== undefined && p.id !== null);
}

const portId = (port: MIDIPort): string => String(port.id);

const describePort = (port: MIDIPort): PortInfo => ({
  id: portId(port),
  name: port.name ?? 'Unnamed port',
  manufacturer: port.manufacturer ?? '',
  connected: port.state !== 'disconnected',
});

/**
 * All ports of one kind: those in the access object's port map, plus any announced only
 * through state-change events (some implementations never fill the maps).
 */
function portsOfType(
  access: MIDIAccess,
  type: 'input' | 'output',
  announced: readonly MIDIPort[],
): MIDIPort[] {
  const byId = new Map<string, MIDIPort>();
  collectPorts(type === 'input' ? access.inputs : access.outputs)
    .forEach((p) => byId.set(portId(p), p));
  announced.filter((p) => p.type === type && !byId.has(portId(p)))
    .forEach((p) => byId.set(portId(p), p));
  // A port that has been unplugged can stay in the map with the state "disconnected".
  return [...byId.values()].filter((p) => p.state !== 'disconnected');
}

export function listPorts(
  access: MIDIAccess,
  announced: readonly MIDIPort[],
): { inputs: PortInfo[]; outputs: PortInfo[] } {
  return {
    inputs: portsOfType(access, 'input', announced).map(describePort),
    outputs: portsOfType(access, 'output', announced).map(describePort),
  };
}

export function findInput(
  access: MIDIAccess,
  id: string,
  announced: readonly MIDIPort[],
): MIDIInput | undefined {
  return portsOfType(access, 'input', announced).find((p) => portId(p) === id) as
    MIDIInput | undefined;
}

export function findOutput(
  access: MIDIAccess,
  id: string,
  announced: readonly MIDIPort[],
): MIDIOutput | undefined {
  return portsOfType(access, 'output', announced).find((p) => portId(p) === id) as
    MIDIOutput | undefined;
}

/**
 * Calls back when ports come or go, with the port from the event if there is one, using
 * the callback property most implementations support.
 */
export function watchPorts(
  access: MIDIAccess,
  onChange: (port: MIDIPort | null) => void,
): () => void {
  const previous = access.onstatechange;
  // eslint-disable-next-line no-param-reassign -- setting the handler is how the API is used
  access.onstatechange = (event) => {
    if (typeof previous === 'function') previous.call(access, event);
    onChange(event && typeof event === 'object' && 'port' in event ? event.port : null);
  };
  return () => {
    // eslint-disable-next-line no-param-reassign -- restores the previous handler
    access.onstatechange = previous;
  };
}

/** Picks the port whose name mentions the pedal, if any. */
export function findPedalPort(ports: readonly PortInfo[]): PortInfo | undefined {
  return ports.find((p) => /2290/.test(p.name)) ?? ports.find((p) => /tc electronic/i.test(p.name));
}

export function describeAccessError(error: unknown): string {
  if (error instanceof DOMException && error.name === 'SecurityError') {
    return 'MIDI access was blocked. Allow MIDI and SysEx for this site in the browser settings.';
  }
  if (error instanceof DOMException && error.name === 'NotAllowedError') {
    return 'MIDI access was declined. Select "Enable MIDI" again and allow access.';
  }
  return error instanceof Error ? error.message : 'MIDI access failed.';
}

const describeMap = (map: unknown): string => {
  if (!map || typeof map !== 'object') return String(map);
  const like = map as PortMapLike & { size?: number; constructor?: { name?: string } };
  const kind = like.constructor?.name ?? 'object';
  const record = like as Record<string, unknown>;
  const methods = ['forEach', 'values', 'get'].filter((m) => typeof record[m] === 'function');
  return `${kind}, size ${like.size ?? '?'}, methods: ${methods.join(', ') || 'none'}`;
};

/** A plain-text summary of what the browser's Web MIDI provides, for troubleshooting. */
export function inspectMidi(
  access: MIDIAccess | null,
  announced: readonly MIDIPort[],
  attempts: readonly string[],
): string {
  const request = typeof navigator !== 'undefined' ? typeof navigator.requestMIDIAccess : 'n/a';
  const lines = [`requestMIDIAccess: ${request}`, ...attempts.map((a) => `attempt ${a}`)];
  if (!access) return [...lines, 'MIDI access: not granted'].join('\n');
  lines.push(`sysexEnabled: ${String(access.sysexEnabled)}`);
  lines.push(`inputs: ${describeMap(access.inputs)}`);
  lines.push(`outputs: ${describeMap(access.outputs)}`);
  lines.push(`announced by events: ${announced.length}`);
  [...collectPorts(access.inputs), ...collectPorts(access.outputs), ...announced].forEach((p) => {
    lines.push(`- ${String(p.type)} id=${String(p.id)} (${typeof p.id}) "${String(p.name)}" `
      + `${String(p.state)}/${String(p.connection)}`);
  });
  return lines.join('\n');
}
