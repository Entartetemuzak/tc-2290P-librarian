import { useId, useState } from 'react';
import FillSection from '../components/FillSection';
import { useApp } from '../state/context';
import { LIBRARY_DRAG_TYPE, LIBRARY_GROUPS, libraryKind } from '../state/library';

export default function LibraryPanel() {
  const { state, actions } = useApp();
  const searchId = useId();
  const [query, setQuery] = useState('');
  const needle = query.trim().toLowerCase();
  const all = Object.values(state.toneprints)
    .filter((t) => !needle || t.name.toLowerCase().includes(needle))
    .sort((a, b) => a.name.localeCompare(b.name));
  const total = Object.keys(state.toneprints).length;
  const librarian = state.link === 'librarian';

  let hint = 'Drag a preset onto a location in the backup file to replace it.';
  if (state.source === 'pedal') {
    hint = state.experimental && librarian
      ? 'Drag a preset onto a location to put it on the pedal.'
      : 'Click a preset for details. Putting presets on the pedal needs the experimental '
        + 'functions under Backup files.';
  }

  return (
    <FillSection title={`Library (${total})`}>
      <label className="field" htmlFor={searchId}>
        Search
        <input
          id={searchId}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      <p className="small muted" style={{ margin: '0.5rem 0' }}>{hint}</p>
      {state.experimental && librarian && (
        <button
          type="button"
          className="button"
          style={{ marginBottom: '0.6rem' }}
          disabled={state.busy !== null}
          onClick={actions.findFactoryPresets}
        >
          Find factory presets on the pedal
        </button>
      )}
      <div className="scroll-area">
        {total === 0 && (
          <p className="empty small">
            No presets yet. Connect the pedal or open a backup file; presets appear here as they
            are read and stay in this browser.
          </p>
        )}
        {LIBRARY_GROUPS.map(({ kind, title }) => {
          const items = all.filter((t) => libraryKind(t) === kind);
          if (items.length === 0) return null;
          return (
            <div key={kind} className="library-group">
              <h3>{`${title} (${items.length})`}</h3>
              <ul>
                {items.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      className="library-item"
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData(LIBRARY_DRAG_TYPE, t.id);
                        e.dataTransfer.effectAllowed = 'copy';
                      }}
                      onClick={() => actions.openDetails({ kind: 'library', id: t.id })}
                    >
                      <span className="library-item__grip" aria-hidden="true" />
                      <span className="library-item__name">{t.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
        {total > 0 && all.length === 0 && (
          <p className="empty small">{`No presets match “${query}”.`}</p>
        )}
      </div>
    </FillSection>
  );
}
