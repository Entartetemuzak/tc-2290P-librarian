import { useId, useState } from 'react';
import ParameterList from '../components/ParameterList';
import { MAX_NAME_LENGTH } from '../protocol/backup';
import { useApp } from '../state/context';
import type { PresetSlot } from '../state/presets';

interface Props {
  preset: PresetSlot;
  allSlots: PresetSlot[];
}

export default function PresetDetails({ preset, allSlots }: Props) {
  const { state, actions } = useApp();
  const nameId = useId();
  const swapId = useId();
  const loadId = useId();
  const [name, setName] = useState(preset.name ?? '');
  const [swapTarget, setSwapTarget] = useState('');
  const [loadTarget, setLoadTarget] = useState('');
  const [confirmLoad, setConfirmLoad] = useState(false);
  const librarian = state.link === 'librarian';
  const busy = state.busy !== null;
  const knownPresets = Object.values(state.toneprints)
    .filter((t) => t.id !== preset.toneprintId)
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <>
      <div className="display" style={{ marginBottom: '0.9rem' }}>
        <p className="display__name">{preset.name ?? 'Unknown preset'}</p>
        {preset.toneprintId && (
          <p className="display__meta">{`TonePrint ${preset.toneprintId}`}</p>
        )}
      </div>

      {preset.isCurrent ? (
        <p className="small muted" style={{ marginTop: 0 }}>This preset is active on the pedal.</p>
      ) : state.link !== 'disconnected' && (
        <div className="button-row" style={{ marginTop: 0, marginBottom: '0.8rem' }}>
          <button
            type="button"
            className="button button--primary"
            onClick={() => actions.recallPreset(preset.index)}
          >
            Load on pedal
          </button>
        </div>
      )}

      {librarian && preset.data && (
        <div className="modal__actions edit-grid">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              actions.renameOnPedal(preset.index, name);
            }}
          >
            <label className="field" htmlFor={nameId}>
              {`Rename (up to ${MAX_NAME_LENGTH} characters)`}
              <input
                id={nameId}
                type="text"
                value={name}
                maxLength={MAX_NAME_LENGTH}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <div className="button-row">
              <button
                type="submit"
                className="button"
                disabled={busy || !name.trim() || name === (preset.name ?? '')}
              >
                Rename
              </button>
            </div>
          </form>

          <div>
            <label className="field" htmlFor={swapId}>
              Swap with another location
              <select
                id={swapId}
                value={swapTarget}
                onChange={(e) => setSwapTarget(e.target.value)}
              >
                <option value="">Choose a location</option>
                {allSlots.filter((s) => s.index !== preset.index).map((s) => (
                  <option key={s.index} value={s.index}>
                    {`${s.label} – ${s.name ?? 'empty'}`}
                  </option>
                ))}
              </select>
            </label>
            <div className="button-row">
              <button
                type="button"
                className="button"
                disabled={busy || swapTarget === ''}
                onClick={() => {
                  actions.swapOnPedal(preset.index, Number(swapTarget));
                  actions.closeDetails();
                }}
              >
                Swap
              </button>
            </div>
          </div>

          <div>
            <label className="field" htmlFor={loadId}>
              Put another preset here
              <select
                id={loadId}
                value={loadTarget}
                onChange={(e) => {
                  setLoadTarget(e.target.value);
                  setConfirmLoad(false);
                }}
              >
                <option value="">Choose a preset</option>
                {knownPresets.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </label>
            {confirmLoad ? (
              <div className="warning" role="alert" style={{ marginTop: '0.6rem' }}>
                {`Replace ${preset.name ?? 'this preset'} with `
                  + `${state.toneprints[loadTarget]?.name ?? 'the chosen preset'}?`}
                <div className="button-row">
                  <button
                    type="button"
                    className="button button--danger"
                    onClick={() => {
                      actions.loadIntoLocation(preset.index, loadTarget);
                      actions.closeDetails();
                    }}
                  >
                    Replace
                  </button>
                  <button type="button" className="button" onClick={() => setConfirmLoad(false)}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="button-row">
                <button
                  type="button"
                  className="button"
                  disabled={busy || loadTarget === ''}
                  onClick={() => setConfirmLoad(true)}
                >
                  {`Put on ${preset.label}`}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {state.link === 'controlOnly' && (
        <p className="small muted">
          {`Loading sends Program Change ${preset.index} on channel ${state.midiChannel}, `}
          which recalls this preset with the pedal&apos;s default MIDI map.
        </p>
      )}

      {preset.data ? <ParameterList data={preset.data} /> : (
        <p className="small muted">
          No parameters yet. They appear once the pedal has returned this preset&apos;s data.
        </p>
      )}
    </>
  );
}
