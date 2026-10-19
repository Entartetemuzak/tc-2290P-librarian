import { useApp } from '../state/context';
import type { ViewId } from '../state/types';
import Led from './Led';

const VIEWS: { id: ViewId; label: string }[] = [
  { id: 'presets', label: 'Presets' },
  { id: 'live', label: 'Live control' },
  { id: 'backup', label: 'Backup files' },
  { id: 'midi', label: 'MIDI setup' },
  { id: 'settings', label: 'Pedal settings' },
  { id: 'monitor', label: 'SysEx monitor' },
];

export default function Navigation() {
  const { state, actions } = useApp();
  return (
    <nav aria-label="Main">
      <ul className="nav" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
        {VIEWS.map((view) => (
          <li key={view.id}>
            <button
              type="button"
              className="nav__item"
              aria-current={state.view === view.id ? 'page' : undefined}
              onClick={() => actions.setView(view.id)}
            >
              <Led state={state.view === view.id ? 'yellow' : 'off'} />
              {view.label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
