import Section from '../components/Section';
import { useApp } from '../state/context';
import { displayValue, settingLabel } from '../state/settingLabels';

const GROUP_TITLES: Record<string, string> = {
  ProductSettings: 'Product settings',
  ProductInfo: 'Product information',
  MidiSettings: 'MIDI settings',
  SystemState: 'Current state',
  HardwareStatus: 'Hardware status',
};

export default function SettingsView() {
  const { state } = useApp();

  return (
    <>
      <div className="view-header">
        <div>
          <h2>Pedal settings</h2>
          <p>
            Everything the pedal reports about its settings and state, read only. Change settings
            in the official app.
          </p>
        </div>
      </div>
      {state.link !== 'librarian' ? (
        <Section title="Not connected">
          <p className="empty">Connect to the pedal over USB to read its settings.</p>
        </Section>
      ) : state.settings.map((group) => (
        <Section key={group.name} title={GROUP_TITLES[group.name] ?? group.name}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Setting</th>
                  <th>Value</th>
                  <th>Unit</th>
                  <th>Key</th>
                </tr>
              </thead>
              <tbody>
                {group.settings.map((s) => (
                  <tr key={s.key}>
                    <td>{settingLabel(s)}</td>
                    <td className="mono">{displayValue(s)}</td>
                    <td>{s.unit === 'N/A' ? '' : s.unit}</td>
                    <td className="mono muted">{s.key}</td>
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
