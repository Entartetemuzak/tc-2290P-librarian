export interface PortInfo {
  id: string;
  name: string;
  manufacturer: string;
  connected: boolean;
}

export const isWebMidiSupported = (): boolean => (
  typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator
);

/** SysEx access is required for the librarian; the browser asks the user for permission. */
export async function requestMidiAccess(): Promise<MIDIAccess> {
  return navigator.requestMIDIAccess({ sysex: true });
}

const describePort = (port: MIDIPort): PortInfo => ({
  id: port.id,
  name: port.name ?? 'Unnamed port',
  manufacturer: port.manufacturer ?? '',
  connected: port.state === 'connected',
});

export function listPorts(access: MIDIAccess): { inputs: PortInfo[]; outputs: PortInfo[] } {
  return {
    inputs: Array.from(access.inputs.values(), describePort),
    outputs: Array.from(access.outputs.values(), describePort),
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
