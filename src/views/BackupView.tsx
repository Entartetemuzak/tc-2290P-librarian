import { useId, useMemo, useState } from 'react';
import Led from '../components/Led';
import Section from '../components/Section';
import { changedLocations } from '../state/backups';
import { useApp } from '../state/context';
import { buildPresetSlots } from '../state/presets';

export default function BackupView() {
  const { state, actions } = useApp();
  const fileId = useId();
  const [dragging, setDragging] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const { backupFile } = state;
  const librarian = state.link === 'librarian';
  const busy = state.busy !== null;
  const slots = useMemo(() => buildPresetSlots(state), [state]);
  const changes = useMemo(
    () => (backupFile && librarian ? changedLocations(backupFile.presets, state.assignments) : []),
    [backupFile, librarian, state.assignments],
  );

  const openFiles = (files: FileList | null) => {
    const file = files?.[0];
    setConfirming(false);
    if (file) actions.openBackup(file);
  };

  return (
    <>
      <div className="view-header">
        <div>
          <h2>Backups</h2>
          <p>
            Save everything on the pedal to a file, or put a saved file back on the pedal. Files
            use the same .tc2290B format as the official app and never leave your computer.
          </p>
        </div>
      </div>

      <Section title="Back up the pedal">
        <p style={{ marginTop: 0 }}>
          Saves all 128 presets and their locations to a .tc2290B file.
        </p>
        <div className="button-row">
          <button
            type="button"
            className="button button--primary"
            disabled={!librarian || busy}
            onClick={actions.backUpPedal}
          >
            Save pedal to file
          </button>
        </div>
        {!librarian && (
          <p className="small muted">Connect the pedal over USB to back it up.</p>
        )}
      </Section>

      <Section title="Restore a backup">
        {!backupFile ? (
          <label
            htmlFor={fileId}
            className={dragging ? 'drop-zone drop-zone--active' : 'drop-zone'}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              openFiles(e.dataTransfer.files);
            }}
          >
            <span>Drop a .tc2290B file here, or choose one</span>
            <input
              id={fileId}
              type="file"
              accept=".tc2290B,application/json"
              onChange={(e) => openFiles(e.target.files)}
            />
          </label>
        ) : (
          <>
            <div className="status-line">
              <Led state={backupFile.checksumValid ? 'yellow' : 'red'} />
              <span>
                {`${backupFile.fileName}: ${backupFile.presets.length} presets, ${
                  backupFile.checksumValid ? 'checksum OK' : 'checksum does not match'}`}
              </span>
            </div>

            {!librarian && (
              <p className="small muted">
                Connect the pedal over USB to see what would change and to restore.
              </p>
            )}

            {librarian && changes.length === 0 && (
              <p>This file matches what is on the pedal. There is nothing to restore.</p>
            )}

            {librarian && changes.length > 0 && (
              <>
                <p>
                  {changes.length === 128
                    ? 'Restoring replaces every location on the pedal.'
                    : `Restoring changes ${changes.length} of 128 locations; `
                      + 'the rest stay as they are.'}
                </p>
                <div className="table-wrap change-list">
                  <table>
                    <thead>
                      <tr>
                        <th>Location</th>
                        <th>On the pedal now</th>
                        <th>From the file</th>
                      </tr>
                    </thead>
                    <tbody>
                      {changes.map((index) => (
                        <tr key={index}>
                          <td className="mono">{slots[index]?.label}</td>
                          <td>{slots[index]?.name ?? 'Unknown'}</td>
                          <td>{backupFile.presets[index]?.name}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {confirming ? (
              <div className="warning" role="alert" style={{ marginTop: '0.9rem' }}>
                {`Replace ${changes.length} presets on the pedal with the ones in `
                  + `${backupFile.fileName}? Back up the pedal first if you may want them back.`}
                <div className="button-row">
                  <button
                    type="button"
                    className="button button--danger"
                    onClick={() => {
                      setConfirming(false);
                      actions.restoreBackup();
                    }}
                  >
                    Restore to pedal
                  </button>
                  <button type="button" className="button" onClick={() => setConfirming(false)}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="button-row">
                <button
                  type="button"
                  className="button button--danger"
                  disabled={!librarian || busy || changes.length === 0}
                  onClick={() => setConfirming(true)}
                >
                  Restore to pedal…
                </button>
                <button type="button" className="button" onClick={actions.closeBackup}>
                  Close file
                </button>
              </div>
            )}
          </>
        )}
      </Section>

      <Section title="Presets remembered in this browser">
        <p className="small" style={{ marginTop: 0 }}>
          {`${Object.keys(state.toneprints).length} presets. `}
          Read from the pedal when you connect and from backup files you open, and kept in this
          browser for the library.
        </p>
        <div className="button-row">
          <button
            type="button"
            className="button"
            disabled={!librarian || busy}
            onClick={actions.readPresetNames}
          >
            Read all presets from the pedal again
          </button>
          <button
            type="button"
            className="button"
            disabled={Object.keys(state.toneprints).length === 0}
            onClick={actions.forgetPresets}
          >
            Forget remembered presets
          </button>
        </div>
      </Section>
    </>
  );
}
