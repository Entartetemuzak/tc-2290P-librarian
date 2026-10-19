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

  const hint = librarian
    ? 'Drag a preset onto a location to put it on the pedal. Click for details.'
    : 'Every preset this browser has seen. Click for details; connect the pedal to use them.';

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
      <div className="scroll-area">
        {LIBRARY_GROUPS.map(({ kind, title, empty }) => {
          const items = all.filter((t) => libraryKind(t) === kind);
          // While searching, groups without matches would only add noise.
          if (needle && items.length === 0) return null;
          return (
            <details key={kind} className="library-group" open>
              <summary><h3>{`${title} (${items.length})`}</h3></summary>
              {items.length === 0 && <p className="library-group__empty">{empty}</p>}
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
            </details>
          );
        })}
        {total > 0 && all.length === 0 && (
          <p className="empty small">{`No presets match “${query}”.`}</p>
        )}
      </div>
    </FillSection>
  );
}
