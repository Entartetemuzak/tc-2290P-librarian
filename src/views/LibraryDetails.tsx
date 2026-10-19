import { useId, useState } from 'react';
import ParameterList from '../components/ParameterList';
import type { Toneprint } from '../protocol/model';
import { LIBRARY_GROUPS, libraryKind } from '../state/library';
import type { PresetSlot } from '../state/presets';

interface Props {
  toneprint: Toneprint;
  slots: PresetSlot[];
  /** null when the preset cannot be placed in the current view. */
  placeTarget: 'pedal' | 'file' | null;
  onPlace: (index: number) => void;
}

export default function LibraryDetails({
  toneprint, slots, placeTarget, onPlace,
}: Props) {
  const placeId = useId();
  const [target, setTarget] = useState('');
  const [confirming, setConfirming] = useState(false);
  const kind = LIBRARY_GROUPS.find((g) => g.kind === libraryKind(toneprint))?.title ?? '';
  const targetSlot = target === '' ? undefined : slots[Number(target)];

  return (
    <>
      <div className="display" style={{ marginBottom: '1rem' }}>
        <p className="display__name">{toneprint.name}</p>
        <p className="display__meta">{`${kind} · TonePrint ${toneprint.id}`}</p>
      </div>

      {placeTarget && (
        <div className="modal__actions">
          <label className="field" htmlFor={placeId}>
            {placeTarget === 'pedal' ? 'Put on a pedal location' : 'Put on a location in the file'}
            <select
              id={placeId}
              value={target}
              onChange={(e) => {
                setTarget(e.target.value);
                setConfirming(false);
              }}
            >
              <option value="">Choose a location</option>
              {slots.map((s) => (
                <option key={s.index} value={s.index}>{`${s.label} – ${s.name ?? 'empty'}`}</option>
              ))}
            </select>
          </label>
          {confirming && targetSlot ? (
            <div className="warning" role="alert" style={{ marginTop: '0.6rem' }}>
              {`Put ${toneprint.name} on ${targetSlot.label}, replacing `
                + `${targetSlot.name ?? 'the preset there'}?`}
              <div className="button-row">
                <button
                  type="button"
                  className="button button--danger"
                  onClick={() => onPlace(targetSlot.index)}
                >
                  Put on pedal
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
                className="button button--primary"
                disabled={!targetSlot}
                onClick={() => {
                  if (!targetSlot) return;
                  if (placeTarget === 'pedal') setConfirming(true);
                  else onPlace(targetSlot.index);
                }}
              >
                Put on location
              </button>
            </div>
          )}
        </div>
      )}

      <ParameterList data={toneprint.data} />
    </>
  );
}
