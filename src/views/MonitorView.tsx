import { useId, useState } from 'react';
import Section from '../components/Section';
import type { TrafficEntry } from '../midi/types';
import { decodeMessage } from '../protocol/decode';
import { extractSysExFromText, toHex } from '../protocol/frame';
import { useApp } from '../state/context';
import downloadText from '../utils/download';

const timeOf = (ms: number): string => new Date(ms).toLocaleTimeString([], { hour12: false });

function describe(bytes: number[]): { title: string; detail: string } {
  const decoded = decodeMessage(bytes);
  if (!decoded) {
    return { title: bytes[0] === 0xf0 ? 'SysEx (other)' : 'MIDI', detail: toHex(bytes) };
  }
  const session = decoded.header ? ` · session ${decoded.header.sessionId}` : '';
  const live = decoded.liveDelayMs === undefined ? '' : ` · ${decoded.liveDelayMs.toFixed(1)} ms`;
  const body = decoded.body === undefined ? '' : `\n\n${JSON.stringify(decoded.body, null, 2)}`;
  const error = decoded.error ? `\n\n${decoded.error}` : '';
  return {
    title: `${decoded.title}${session}${live}`,
    detail: `${toHex(bytes)}${body}${error}`,
  };
}

interface EntryData {
  time: number | null;
  direction: TrafficEntry['direction'];
  bytes: number[];
}

function Entry({ entry }: { entry: EntryData }) {
  const { title, detail } = describe(entry.bytes);
  return (
    <div className="log-entry">
      <span className="muted mono">{entry.time === null ? '–' : timeOf(entry.time)}</span>
      <span className={`log-entry__dir--${entry.direction}`}>
        {entry.direction === 'in' ? 'Pedal' : 'App'}
      </span>
      <details>
        <summary>{`${title} · ${entry.bytes.length} bytes`}</summary>
        <pre>{detail}</pre>
      </details>
    </div>
  );
}

export default function MonitorView() {
  const { state, actions } = useApp();
  const pasteId = useId();
  const [pasted, setPasted] = useState('');
  const pastedMessages = extractSysExFromText(pasted);

  return (
    <>
      <div className="view-header">
        <div>
          <h2>SysEx monitor</h2>
          <p>
            Every MIDI message between this app and the pedal, decoded. You can also paste
            captures from a MIDI monitor to decode them.
          </p>
        </div>
      </div>

      <Section title={`Traffic (${state.traffic.length})`}>
        <div className="button-row" style={{ marginTop: 0, marginBottom: '0.8rem' }}>
          <button
            type="button"
            className="button"
            disabled={state.traffic.length === 0}
            onClick={() => downloadText(
              'delay-librarian-log.txt',
              state.traffic.map((t) => `${timeOf(t.time)}\t${t.direction}\t${toHex(t.bytes)}`)
                .join('\n'),
              'text/plain',
            )}
          >
            Save log
          </button>
          <button
            type="button"
            className="button"
            disabled={state.traffic.length === 0}
            onClick={actions.clearTraffic}
          >
            Clear
          </button>
        </div>
        {state.traffic.length === 0 ? (
          <p className="empty">No messages yet. Connect to the pedal to see traffic here.</p>
        ) : (
          <div className="log">
            {state.traffic.map((entry) => <Entry key={entry.id} entry={entry} />)}
          </div>
        )}
      </Section>

      <Section title="Decode a capture">
        <label className="field" htmlFor={pasteId}>
          Paste SysEx messages. Full MIDI Monitor log lines work; other text is ignored.
          <textarea id={pasteId} value={pasted} onChange={(e) => setPasted(e.target.value)} />
        </label>
        {pasted && pastedMessages.length === 0 && (
          <p className="small muted">No complete F0 … F7 message found.</p>
        )}
        {pastedMessages.length > 0 && (
          <div className="log" style={{ marginTop: '0.8rem' }}>
            {pastedMessages.map((m, i) => (
              <Entry
                // Pasted messages have no identity beyond their position.
                // eslint-disable-next-line react/no-array-index-key
                key={i}
                entry={{
                  time: null,
                  direction: m.direction === 'out' ? 'out' : 'in',
                  bytes: m.bytes,
                }}
              />
            ))}
          </div>
        )}
      </Section>
    </>
  );
}
