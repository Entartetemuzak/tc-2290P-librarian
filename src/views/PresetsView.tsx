import { useMemo, useState } from 'react';
import Led from '../components/Led';
import Section from '../components/Section';
import { BOARD_COUNT } from '../protocol/constants';
import { useApp } from '../state/context';
import { type PresetSlot, buildPresetSlots } from '../state/presets';
import PresetDetails from './PresetDetails';

function Tile({
  slot, selected, draggable, dropTarget, onSelect, onDragStart, onDragEnter, onDrop,
}: {
  slot: PresetSlot;
  selected: boolean;
  draggable: boolean;
  dropTarget: boolean;
  onSelect: () => void;
  onDragStart: () => void;
  onDragEnter: () => void;
  onDrop: () => void;
}) {
  const classes = ['lcd'];
  if (!slot.name && !slot.toneprintId) classes.push('lcd--empty');
  if (slot.isCurrent) classes.push('lcd--current');
  if (dropTarget) classes.push('lcd--drop');
  let label = slot.name;
  if (!label) label = slot.toneprintId ? `ID ${slot.toneprintId.slice(0, 8)}` : 'Empty';
  return (
    <button
      type="button"
      className={classes.join(' ')}
      aria-pressed={selected}
      aria-label={`Preset ${slot.label}: ${label}${slot.isCurrent ? ', active on the pedal' : ''}`}
      draggable={draggable}
      onClick={onSelect}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move';
        onDragStart();
      }}
      onDragEnter={onDragEnter}
      onDragOver={(e) => {
        if (draggable) e.preventDefault();
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDrop();
      }}
    >
      <span className="lcd__slot">{slot.slot === 0 ? 'A' : 'B'}</span>
      <span className="lcd__name">{label}</span>
      {slot.isCurrent && <Led state="on" />}
    </button>
  );
}

export default function PresetsView() {
  const { state, actions } = useApp();
  const slots = useMemo(() => buildPresetSlots(state), [state]);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const editable = state.source === 'library' && state.library !== null;
  const hasPedal = state.link === 'librarian';
  const selected = slots[state.selectedIndex] ?? slots[0];

  const nothingToShow = !hasPedal && !state.library;
  const fileName = state.library?.fileName ?? '';

  return (
    <>
      <div className="view-header">
        <div>
          <h2>Presets</h2>
          <p>
            64 boards, each with preset A and B. Select a tile to see its parameters; drag tiles
            to rearrange presets in an open backup file.
          </p>
        </div>
        <div className="source-switch" role="group" aria-label="Show presets from">
          <button
            type="button"
            aria-pressed={state.source === 'pedal'}
            disabled={!hasPedal}
            onClick={() => actions.setSource('pedal')}
          >
            Pedal
          </button>
          <button
            type="button"
            aria-pressed={state.source === 'library'}
            disabled={!state.library}
            onClick={() => actions.setSource('library')}
          >
            Backup file
          </button>
        </div>
      </div>

      {nothingToShow ? (
        <Section title="Getting started">
          <p className="empty">
            Connect the pedal over USB and select Connect, or open a backup file under Backup
            files. Both show the same 128 preset locations here.
          </p>
        </Section>
      ) : (
        <div className="organizer">
          <Section title={editable ? `Backup file: ${fileName}` : 'On the pedal'}>
            <div className="board-list">
              {Array.from({ length: BOARD_COUNT }, (_, b) => {
                const pair = [slots[b * 2], slots[b * 2 + 1]];
                return (
                  <div className="board" key={b}>
                    <span className="digits" aria-hidden="true">
                      {String(b + 1).padStart(2, '0')}
                    </span>
                    {pair.map((slot) => slot && (
                      <Tile
                        key={slot.index}
                        slot={slot}
                        selected={slot.index === state.selectedIndex}
                        draggable={editable}
                        dropTarget={editable && dragOver === slot.index && dragFrom !== slot.index}
                        onSelect={() => actions.select(slot.index)}
                        onDragStart={() => setDragFrom(slot.index)}
                        onDragEnter={() => setDragOver(slot.index)}
                        onDrop={() => {
                          if (dragFrom !== null) actions.swapPresets(dragFrom, slot.index);
                          setDragFrom(null);
                          setDragOver(null);
                        }}
                      />
                    ))}
                  </div>
                );
              })}
            </div>
          </Section>
          {selected && (
            <PresetDetails
              key={`${selected.index}:${selected.toneprintId ?? ''}`}
              preset={selected}
              allSlots={slots}
            />
          )}
        </div>
      )}
    </>
  );
}
