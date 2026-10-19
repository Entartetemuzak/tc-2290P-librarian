import { useId, useState } from 'react';
import Led from '../components/Led';
import Section from '../components/Section';
import { useApp } from '../state/context';

export default function BackupView() {
  const { state, actions } = useApp();
  const fileId = useId();
  const experimentalId = useId();
  const [dragging, setDragging] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const { library } = state;
  const librarian = state.link === 'librarian';

  const openFiles = (files: FileList | null) => {
    const file = files?.[0];
    if (file) actions.openBackup(file);
  };

  return (
    <>
      <div className="view-header">
        <div>
          <h2>Backup files</h2>
          <p>
            Open a .tc2290B file made with Backup Pedal in the official app. Rename and rearrange
            presets, then save a new file and load it with Restore Backup. Nothing is uploaded:
            files are read and written in your browser.
          </p>
        </div>
      </div>

      <Section title="Backup file">
        {library ? (
          <>
            <div className="status-line">
              <Led state={library.checksumValid ? 'yellow' : 'red'} />
              <span>
                {library.checksumValid
                  ? `${library.fileName}: ${library.presets.length} presets, checksum OK`
                  : `${library.fileName}: checksum does not match`}
              </span>
            </div>
            {library.modified && (
              <div className="status-line">
                <Led state="red" />
                <span>Changed since opening. Save a new file to keep the changes.</span>
              </div>
            )}
            <div className="button-row">
              <button
                type="button"
                className="button button--primary"
                onClick={actions.saveBackup}
              >
                Save backup file
              </button>
              <button
                type="button"
                className="button"
                onClick={() => {
                  actions.setSource('library');
                  actions.setView('presets');
                }}
              >
                Edit presets
              </button>
              <button type="button" className="button" onClick={actions.closeBackup}>
                Close file
              </button>
            </div>
            <p className="small muted">
              Renamed presets get a new TonePrint ID, so Restore Backup uploads them instead of
              keeping the old version on the pedal.
            </p>
          </>
        ) : (
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
        )}
      </Section>

      <Section title="Presets remembered in this browser">
        <p className="small" style={{ marginTop: 0 }}>
          {`${Object.keys(state.toneprints).length} presets. `}
          Names and parameters are read from the pedal when you connect and from backup files you
          open, then kept in this browser so they show up at once next time.
        </p>
        <div className="button-row">
          <button
            type="button"
            className="button"
            disabled={!librarian || state.busy !== null}
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

      <Section title="Experimental: write to the pedal">
        <p className="small">
          Writes presets to the pedal the way the official app does. Verified against captured
          traffic only, so take a backup with the official app first. When enabled, the Presets
          page can also put any remembered preset on a location.
        </p>
        <label className="checkbox" htmlFor={experimentalId}>
          <input
            id={experimentalId}
            type="checkbox"
            checked={state.experimental}
            onChange={(e) => {
              actions.setExperimental(e.target.checked);
              setConfirming(false);
            }}
          />
          Enable experimental functions
        </label>
        {state.experimental && (
          <>
            {confirming ? (
              <div className="warning" role="alert">
                <p style={{ marginTop: 0 }}>
                  This uploads every preset in the file that the pedal does not already have,
                  then overwrites all 128 preset locations. Continue?
                </p>
                <div className="button-row">
                  <button
                    type="button"
                    className="button button--danger"
                    onClick={() => {
                      setConfirming(false);
                      actions.writeBackupToPedal();
                    }}
                  >
                    Write to pedal
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
                  disabled={!librarian || !library || state.busy !== null}
                  onClick={() => setConfirming(true)}
                >
                  Write this backup to the pedal…
                </button>
              </div>
            )}
            {!librarian && (
              <p className="small muted">Connect to the pedal over USB to use these functions.</p>
            )}
          </>
        )}
      </Section>
    </>
  );
}
