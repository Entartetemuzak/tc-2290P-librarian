import Section from '../components/Section';
import { useApp } from '../state/context';
import { slotLabel } from '../state/presets';

export default function MidiView() {
  const { state } = useApp();
  const midiSettings = state.settings.find((g) => g.name === 'MidiSettings');
  const directions = [...new Set(state.pcMap.map((m) => m.direction))].sort();

  return (
    <>
      <div className="view-header">
        <div>
          <h2>MIDI setup</h2>
          <p>
            The pedal&apos;s MIDI settings, Program Change map and Control Change map, as read
            from the pedal. Change them in the official app.
          </p>
        </div>
      </div>

      {state.link !== 'librarian' ? (
        <Section title="Not connected">
          <p className="empty">Connect to the pedal over USB to read its MIDI setup.</p>
        </Section>
      ) : (
        <>
          <Section title="MIDI global and clock">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Setting</th>
                    <th>Value</th>
                  </tr>
                </thead>
                <tbody>
                  {(midiSettings?.settings ?? []).map((s) => (
                    <tr key={s.key}>
                      <td>{s.key}</td>
                      <td className="mono">
                        {s.allowedValues.find((a) => a.value === s.value)?.name ?? s.value}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          {directions.map((direction) => (
            <Section key={direction} title={`Program Change map, direction ${direction}`}>
              <p className="small muted">
                The protocol marks MIDI IN and MIDI OUT with a direction number; which is which is
                not yet confirmed.
              </p>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Program</th>
                      <th>Preset</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.pcMap.filter((m) => m.direction === direction).map((m) => (
                      <tr key={`${m.program}-${m.board}-${m.slot}`}>
                        <td className="mono">{m.program}</td>
                        <td className="mono">{slotLabel(m.board, m.slot)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          ))}

          <Section title="Control Change map">
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>CC</th>
                    <th>Action</th>
                    <th>Output</th>
                  </tr>
                </thead>
                <tbody>
                  {state.ccMap.map((m) => (
                    <tr key={`${m.cc}-${m.action}`}>
                      <td className="mono">{m.cc}</td>
                      <td>{m.action}</td>
                      <td>{m.output || m.ranges.map((r) => r.description).join(', ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        </>
      )}
    </>
  );
}
