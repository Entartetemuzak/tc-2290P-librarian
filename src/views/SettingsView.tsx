import Section from '../components/Section';
import { useApp } from '../state/context';

export default function SettingsView() {
  const { state } = useApp();

  return (
    <>
      <div className="view-header">
        <div>
          <h2>Pedal settings</h2>
          <p>
            Every settings group the pedal reports, read only. Values with a list of allowed
            values show their label.
          </p>
        </div>
      </div>
      {state.link !== 'librarian' ? (
        <Section title="Not connected">
          <p className="empty">Connect to the pedal over USB to read its settings.</p>
        </Section>
      ) : state.settings.map((group) => (
        <Section key={group.name} title={group.name}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Key</th>
                  <th>Value</th>
                  <th>Unit</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                {group.settings.map((s) => (
                  <tr key={s.key}>
                    <td>{s.key}</td>
                    <td className="mono">
                      {s.allowedValues.find((a) => a.value === s.value)?.name ?? s.value}
                    </td>
                    <td>{s.unit === 'N/A' ? '' : s.unit}</td>
                    <td>{s.descriptionShort}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      ))}
    </>
  );
}
