import ConnectionPanel from './ConnectionPanel';
import Navigation from './Navigation';

export default function Sidebar() {
  return (
    <aside className="ear">
      <header className="brand">
        <h1 className="brand__name">Delay Librarian</h1>
        <p className="brand__tagline">Unofficial 2290 P web librarian</p>
      </header>
      <ConnectionPanel />
      <Navigation />
      <footer className="ear__footer">
        <p>
          Not affiliated with or endorsed by TC Electronic. 2290 P is a product name of its
          owner, used here only to describe compatibility.
        </p>
        <p>Take a backup with the official app before writing anything to the pedal.</p>
      </footer>
    </aside>
  );
}
