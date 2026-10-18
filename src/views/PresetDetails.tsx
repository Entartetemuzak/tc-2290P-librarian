import { useId, useState } from 'react';
import Section from '../components/Section';
import { MAX_NAME_LENGTH } from '../protocol/backup';
import { describeParameters } from '../protocol/params';
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
  const editable = state.source === 'library' && state.library !== null;
  const canRecall = state.link !== 'disconnected';

  const parameters = preset.data ? describeParameters(preset.data) : [];
  const sections = [...new Set(parameters.map((p) => p.section))];

  return (
    <Section title={`Preset ${preset.label}`}>
      <p style={{ margin: '0 0 0.75rem', fontSize: 'var(--step-1)' }}>
        {preset.name ?? 'Unknown preset'}
      </p>
      {preset.toneprintId && (
        <p className="small muted mono" style={{ margin: '0 0 0.9rem', wordBreak: 'break-all' }}>
          {`TonePrint ${preset.toneprintId}`}
        </p>
      )}

      <div className="button-row" style={{ marginTop: 0 }}>
        <button
          type="button"
          className="button button--primary"
          disabled={!canRecall}
          onClick={() => actions.recallPreset(preset.index)}
        >
          Recall on pedal
        </button>
      </div>
      {!canRecall && <p className="small muted">Connect to the pedal to recall presets.</p>}
      {state.link === 'controlOnly' && (
        <p className="small muted">
          Sends Program Change
          {` ${preset.index} `}
          on channel
          {` ${state.midiChannel}`}
          , which recalls this preset with the pedal&apos;s default MIDI map.
        </p>
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
        {parameters.length === 0 ? (
          <p className="small muted">
            Parameters are shown when the preset data is known: open a backup file in Backup
            files, or read the TonePrints from the pedal there.
          </p>
        ) : sections.map((section) => (
          <div className="param-group" key={section}>
            <h4>{section}</h4>
            <dl style={{ margin: 0 }}>
              {parameters.filter((p) => p.section === section).map((p) => (
                <div
                  key={p.word}
                  className={p.kind === 'hidden' ? 'param-row param-row--hidden' : 'param-row'}
                >
                  <dt>{p.name}</dt>
                  <dd>{p.display}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
    </Section>
  );
}
