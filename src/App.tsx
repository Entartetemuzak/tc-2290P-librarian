import NoticeBar from './components/NoticeBar';
import Sidebar from './components/Sidebar';
import { useApp } from './state/context';
import type { ViewId } from './state/types';
import BackupView from './views/BackupView';
import LiveView from './views/LiveView';
import MidiView from './views/MidiView';
import MonitorView from './views/MonitorView';
import PresetsView from './views/PresetsView';
import SettingsView from './views/SettingsView';

const VIEWS: Record<ViewId, () => React.JSX.Element> = {
  presets: PresetsView,
  live: LiveView,
  backup: BackupView,
  midi: MidiView,
  settings: SettingsView,
  monitor: MonitorView,
};

export default function App() {
  const { state } = useApp();
  const View = VIEWS[state.view];
  return (
    <div className="rack">
      <Sidebar />
      <main className="face">
        <View />
      </main>
      <NoticeBar />
    </div>
  );
}
