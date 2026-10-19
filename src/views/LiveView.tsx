import { useId, useState } from 'react';
import Section from '../components/Section';
import { CONTROLS, type ControlDefinition, PEDAL_ACTIONS } from '../protocol/ccMap';
import { useApp } from '../state/context';

interface ControlProps {
  control: ControlDefinition;
  disabled: boolean;
  initial: number;
}

function Control({ control, disabled, initial }: ControlProps) {
  const { actions } = useApp();
  const id = useId();
  const [value, setValue] = useState(initial);
  const send = (next: number) => {
    setValue(next);
    actions.sendControl(control.cc, next);
  };

  if (control.kind === 'toggle') {
    const on = value === control.onValue;
    return (
      <label className="checkbox control" htmlFor={id}>
        <input
          id={id}
          type="checkbox"
          checked={on}
          disabled={disabled}
          onChange={(e) => send(e.target.checked ? control.onValue ?? 127 : control.offValue ?? 0)}
        />
        {`${control.label} (CC ${control.cc})`}
      </label>
    );
  }

  if (control.kind === 'choice') {
    return (
      <label className="field control" htmlFor={id}>
        {`${control.label} (CC ${control.cc})`}
        <select
          id={id}
          value={value}
          disabled={disabled}
          onChange={(e) => send(Number(e.target.value))}
        >
          {(control.options ?? []).map((option, index) => (
            <option key={option} value={index}>{option}</option>
          ))}
        </select>
      </label>
    );
  }

  const max = control.max ?? 127;
  return (
    <label className="control" htmlFor={id}>
      <span className="control__top">
        <span>{`${control.label} (CC ${control.cc})`}</span>
        <span className="control__value">{control.display ? control.display(value) : value}</span>
      </span>
      <input
        id={id}
        type="range"
        min={0}
        max={max}
        value={value}
        disabled={disabled}
        onChange={(e) => send(Number(e.target.value))}
      />
    </label>
  );
}

const PEDAL_BUTTONS = [
  { label: 'Board down', cc: PEDAL_ACTIONS.boardDown, value: 127 },
  { label: 'Board up', cc: PEDAL_ACTIONS.boardUp, value: 127 },
  { label: 'Preset A', cc: PEDAL_ACTIONS.slotA, value: 127 },
  { label: 'Preset B', cc: PEDAL_ACTIONS.slotB, value: 127 },
  { label: 'Tap tempo', cc: PEDAL_ACTIONS.tapTempo, value: 127 },
  { label: 'Bypass', cc: PEDAL_ACTIONS.bypass, value: 0 },
  { label: 'Engage', cc: PEDAL_ACTIONS.bypass, value: 127 },
];

export default function LiveView() {
  const { state, actions } = useApp();
  const activeId = state.current
    ? state.assignments.find((a) => a.group === 0
      && a.board === state.current?.board && a.slot === state.current.slot)?.toneprintId
    : undefined;
  const active = activeId ? state.toneprints[activeId] : undefined;
  const activeLabel = state.current
    ? `${state.current.board}${state.current.slot === 0 ? 'A' : 'B'}`
    : null;
  const channelId = useId();
  const delayId = useId();
  const [delayMs, setDelayMs] = useState('350');
  const disabled = state.link === 'disconnected';
  const sections = [...new Set(CONTROLS.map((c) => c.section))];

  return (
    <>
      <div className="view-header">
        <div>
          <h2>Live control</h2>
          <p>
            Changes the sound in real time with MIDI Control Change, over USB or a 5-pin MIDI
            interface. Controls start at the active preset&apos;s stored values when they are
            known. Changes are kept only when you press STORE on the pedal.
          </p>
        </div>
        {activeLabel && (
          <div className="display" style={{ minWidth: '14rem' }}>
            <p className="display__name">{active?.name ?? 'Unknown preset'}</p>
            <p className="display__meta">{`Active preset ${activeLabel}`}</p>
          </div>
        )}
        {state.liveDelayMs !== null && (
          <div className="readout" role="status" aria-label="Delay time reported by the pedal">
            <span className="small">Delay time</span>
            <strong>{state.liveDelayMs.toFixed(1)}</strong>
            <span className="small">ms</span>
          </div>
        )}
      </div>

      {disabled && (
        <Section title="Not connected">
          <p className="empty">
            Connect to a MIDI output first. Any port that reaches the pedal works.
          </p>
        </Section>
      )}

      <Section title="Pedal">
        <div className="control-grid">
          <label className="field" htmlFor={channelId}>
            MIDI channel (must match the pedal&apos;s Channel In)
            <select
              id={channelId}
              value={state.midiChannel}
              onChange={(e) => actions.setChannel(Number(e.target.value))}
            >
              {Array.from({ length: 16 }, (_, i) => (
                <option key={i + 1} value={i + 1}>{i + 1}</option>
              ))}
            </select>
          </label>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const ms = Number(delayMs);
              if (Number.isFinite(ms)) actions.setDelayTime(ms);
            }}
          >
            <label className="field" htmlFor={delayId}>
              Exact delay time in ms (CC 60–64)
              <input
                id={delayId}
                type="number"
                min={0}
                max={9999.9}
                step={0.1}
                value={delayMs}
                disabled={disabled}
                onChange={(e) => setDelayMs(e.target.value)}
              />
            </label>
            <div className="button-row">
              <button type="submit" className="button" disabled={disabled}>Set delay time</button>
            </div>
          </form>
        </div>
        <div className="button-row">
          {PEDAL_BUTTONS.map(({ label, cc, value }) => (
            <button
              key={label}
              type="button"
              className="button"
              disabled={disabled}
              onClick={() => actions.sendControl(cc, value)}
            >
              {label}
            </button>
          ))}
        </div>
      </Section>

      {sections.map((section) => (
        <Section key={section} title={section}>
          <div className="control-grid">
            {CONTROLS.filter((c) => c.section === section).map((control) => (
              <Control
                key={`${control.cc}:${activeId ?? 'none'}`}
                control={control}
                disabled={disabled}
                initial={active && control.fromPreset ? control.fromPreset(active.data) : 0}
              />
            ))}
          </div>
        </Section>
      ))}
    </>
  );
}
