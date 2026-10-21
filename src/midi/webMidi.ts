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

/** SysEx access is required for the librarian; the browser asks the user for permission. */
export async function requestMidiAccess(): Promise<MIDIAccess> {
  if (!isWebMidiSupported()) {
    throw new Error('This browser has no Web MIDI. Use Chrome, Edge, Opera or Firefox, '
      + 'or on iOS an app that adds Web MIDI to its browser.');
  }
  return navigator.requestMIDIAccess({ sysex: true });
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
  return ports.filter((p) => p && typeof p.id === 'string');
}

const describePort = (port: MIDIPort): PortInfo => ({
  id: port.id,
  name: port.name ?? 'Unnamed port',
  manufacturer: port.manufacturer ?? '',
  connected: port.state !== 'disconnected',
});

export function listPorts(access: MIDIAccess): { inputs: PortInfo[]; outputs: PortInfo[] } {
  return {
    inputs: collectPorts(access.inputs).map(describePort),
    outputs: collectPorts(access.outputs).map(describePort),
  };
}

export function findInput(access: MIDIAccess, id: string): MIDIInput | undefined {
  return collectPorts(access.inputs).find((p) => p.id === id) as MIDIInput | undefined;
}

export function findOutput(access: MIDIAccess, id: string): MIDIOutput | undefined {
  return collectPorts(access.outputs).find((p) => p.id === id) as MIDIOutput | undefined;
}

/** Calls back when ports come or go, using the callback property most implementations support. */
export function watchPorts(access: MIDIAccess, onChange: () => void): () => void {
  const previous = access.onstatechange;
  // eslint-disable-next-line no-param-reassign -- setting the handler is how the API is used
  access.onstatechange = (event) => {
    if (typeof previous === 'function') previous.call(access, event);
    onChange();
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
