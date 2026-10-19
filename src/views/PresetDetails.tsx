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
  const [name, setName] = useState(preset.name ?? '');
  const [swapTarget, setSwapTarget] = useState('');
  const loadId = useId();
  const [loadTarget, setLoadTarget] = useState('');
  const [confirmLoad, setConfirmLoad] = useState(false);
  const editable = state.source === 'library' && state.library !== null;
  const canLoadInto = state.experimental && state.link === 'librarian' && state.source === 'pedal';
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

      {state.source === 'pedal' && state.link !== 'disconnected' && !preset.isCurrent && (
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
      {preset.isCurrent && (
        <p className="small muted" style={{ marginTop: 0 }}>This preset is active on the pedal.</p>
      )}
      {state.link === 'controlOnly' && state.source === 'pedal' && (
        <p className="small muted">
          {`Clicking sends Program Change ${preset.index} on channel ${state.midiChannel}, `}
          which loads this preset with the pedal&apos;s default MIDI map.
        </p>
      )}

      {canLoadInto && (
        <div style={{ marginTop: '1rem' }}>
          <label className="field" htmlFor={loadId}>
            Put another preset here (experimental)
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
              {`Replace ${preset.name ?? 'this preset'} on ${preset.label} with `
                + `${state.toneprints[loadTarget]?.name ?? 'the chosen preset'}?`}
              <div className="button-row">
                <button
                  type="button"
                  className="button button--danger"
                  onClick={() => {
                    setConfirmLoad(false);
                    actions.loadIntoLocation(preset.index, loadTarget);
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
                disabled={loadTarget === '' || state.busy !== null}
                onClick={() => setConfirmLoad(true)}
              >
                {`Put on ${preset.label}`}
              </button>
            </div>
          )}
          <p className="small muted">
            Lists every preset this browser knows: from the pedal and from backup files you have
            opened.
          </p>
        </div>
      )}

      {editable && (
        <form
          style={{ marginTop: '1rem' }}
          onSubmit={(e) => {
            e.preventDefault();
            actions.renamePreset(preset.index, name);
          }}
        >
          <label className="field" htmlFor={nameId}>
            {`Name (up to ${MAX_NAME_LENGTH} characters)`}
            <input
              id={nameId}
              type="text"
              value={name}
              maxLength={MAX_NAME_LENGTH}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <div className="button-row">
            <button type="submit" className="button" disabled={name === (preset.name ?? '')}>
              Rename
            </button>
          </div>
          <label className="field" htmlFor={swapId} style={{ marginTop: '1rem' }}>
            Swap with another location (or drag a tile onto another)
            <select id={swapId} value={swapTarget} onChange={(e) => setSwapTarget(e.target.value)}>
              <option value="">Choose a location</option>
              {allSlots.filter((s) => s.index !== preset.index).map((s) => (
                <option key={s.index} value={s.index}>{`${s.label} – ${s.name ?? 'empty'}`}</option>
              ))}
            </select>
          </label>
          <div className="button-row">
            <button
              type="button"
              className="button"
              disabled={swapTarget === ''}
              onClick={() => actions.swapPresets(preset.index, Number(swapTarget))}
            >
              Swap
            </button>
          </div>
        </form>
      )}

      <div style={{ marginTop: '1.25rem' }}>
        {!preset.data ? (
          <p className="small muted">
            No parameters yet. They appear when the pedal has returned this preset&apos;s data,
            or when a backup file containing it has been opened.
          </p>
        ) : <ParameterList data={preset.data ?? []} />}
      </div>
    </>
  );
}
