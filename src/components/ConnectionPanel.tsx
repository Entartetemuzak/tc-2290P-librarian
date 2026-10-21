import { useId } from 'react';
import { useApp } from '../state/context';
import type { LinkMode, MidiStatus } from '../state/types';
import Led, { type LedState } from './Led';
import Section from './Section';

const MIDI_TEXT: Record<MidiStatus, string> = {
  unsupported: 'This browser has no Web MIDI. Use Chrome, Edge, Opera or Firefox, or on iOS an '
    + 'app that adds Web MIDI to its browser.',
  idle: 'MIDI is off. Enable it to find the pedal.',
  requesting: 'Waiting for MIDI permission…',
  ready: 'MIDI enabled',
  error: 'MIDI unavailable',
};

const MIDI_PROBLEM = new Set<MidiStatus>(['error', 'unsupported']);

const LINK_TEXT: Record<LinkMode, string> = {
  disconnected: 'Not connected',
  connecting: 'Connecting…',
  librarian: 'Connected over SysEx (USB)',
  controlOnly: 'MIDI control only (CC and PC)',
};

const LINK_LED: Record<LinkMode, LedState> = {
  disconnected: 'red',
  connecting: 'blink',
  librarian: 'yellow',
  controlOnly: 'yellow',
};

export default function ConnectionPanel() {
  const { state, actions } = useApp();
  const inputId = useId();
  const outputId = useId();
  const connected = state.link !== 'disconnected';

  if (state.midiStatus !== 'ready') {
    return (
      <Section title="Connection">
        <div className="status-line">
          <Led state={MIDI_PROBLEM.has(state.midiStatus) ? 'red' : 'off'} />
          <span>{MIDI_TEXT[state.midiStatus]}</span>
        </div>
        {state.midiError && <p className="small muted">{state.midiError}</p>}
        <div className="button-row">
          <button
            type="button"
            className="button button--primary"
            onClick={actions.enableMidi}
            disabled={state.midiStatus === 'requesting'}
          >
            Enable MIDI
          </button>
        </div>
      </Section>
    );
  }

  return (
    <Section title="Connection">
      <label className="field" htmlFor={inputId}>
        MIDI input (from the pedal)
        <select
          id={inputId}
          value={state.inputId}
          onChange={(e) => actions.choosePorts(e.target.value, state.outputId)}
        >
          {state.inputs.length === 0 && <option value="">No MIDI inputs found</option>}
          {state.inputs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </label>
      <label className="field" htmlFor={outputId}>
        MIDI output (to the pedal)
        <select
          id={outputId}
          value={state.outputId}
          onChange={(e) => actions.choosePorts(state.inputId, e.target.value)}
        >
          {state.outputs.length === 0 && <option value="">No MIDI outputs found</option>}
          {state.outputs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </label>
      <p className="small muted" style={{ margin: '0.5rem 0 0' }}>
        {`Found ${state.inputs.length} input${state.inputs.length === 1 ? '' : 's'} and `
          + `${state.outputs.length} output${state.outputs.length === 1 ? '' : 's'}.`}
      </p>
      <div className="button-row">
        {connected ? (
          <button type="button" className="button" onClick={actions.disconnect}>Disconnect</button>
        ) : (
          <button
            type="button"
            className="button button--primary"
            onClick={actions.connect}
            disabled={!state.inputId || !state.outputId}
          >
            Connect
          </button>
        )}
        {!connected && (
          <button type="button" className="button" onClick={actions.refreshPorts}>
            Refresh ports
          </button>
        )}
      </div>
      <div className="status-line" style={{ marginTop: '0.8rem' }}>
        <Led state={LINK_LED[state.link]} />
        <span>{LINK_TEXT[state.link]}</span>
      </div>
      {state.version && (
        <div className="status-line muted">
          <span>{`Protocol version ${state.version[2] ?? '?'}`}</span>
        </div>
      )}
      {state.busy && (
        <div className="busy" role="status" style={{ marginTop: '0.6rem' }}>
          <Led state="blink" />
          <span>{state.busy}</span>
        </div>
      )}
    </Section>
  );
}
