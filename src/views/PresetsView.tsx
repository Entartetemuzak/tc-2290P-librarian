import { type DragEvent, useMemo, useState } from 'react';
import FillSection from '../components/FillSection';
import Led from '../components/Led';
import Modal from '../components/Modal';
import { BOARD_COUNT } from '../protocol/constants';
import { useApp } from '../state/context';
import { LIBRARY_DRAG_TYPE, LOCATION_DRAG_TYPE } from '../state/library';
import { type PresetSlot, buildPresetSlots } from '../state/presets';
import LibraryDetails from './LibraryDetails';
import LibraryPanel from './LibraryPanel';
import PresetDetails from './PresetDetails';

type Dropped = { kind: 'library'; toneprintId: string } | { kind: 'location'; index: number };

function readDrop(e: DragEvent): Dropped | null {
  const toneprintId = e.dataTransfer.getData(LIBRARY_DRAG_TYPE);
  if (toneprintId) return { kind: 'library', toneprintId };
  const location = e.dataTransfer.getData(LOCATION_DRAG_TYPE);
  return location === '' ? null : { kind: 'location', index: Number(location) };
}

interface TileProps {
  slot: PresetSlot;
  selected: boolean;
  editable: boolean;
  dropTarget: boolean;
  reading: boolean;
  /** Connected for MIDI control only: a click sends Program Change. */
  controlOnly: boolean;
  onSelect: () => void;
  onDetails: () => void;
  onDragEnter: () => void;
  onDrop: (dropped: Dropped | null) => void;
}

function Tile({
  slot, selected, editable, dropTarget, reading, controlOnly,
  onSelect, onDetails, onDragEnter, onDrop,
}: TileProps) {
  const classes = ['lcd'];
  if (!slot.name && !slot.toneprintId) classes.push('lcd--empty');
  if (slot.isCurrent) classes.push('lcd--current');
  if (dropTarget) classes.push('lcd--drop');
  let label = slot.name;
  if (!label && reading) label = 'Reading…';
  if (!label && controlOnly) label = `Program ${slot.index}`;
  if (!label) label = slot.toneprintId ? `ID ${slot.toneprintId.slice(0, 8)}` : 'Empty';
  return (
    <div className="tile">
      <button
        type="button"
        className={classes.join(' ')}
        aria-pressed={selected}
        aria-label={`Preset ${slot.label}: ${label}${slot.isCurrent ? ', active' : ''}`}
        draggable={editable}
        onClick={onSelect}
        onDragStart={(e) => {
          e.dataTransfer.setData(LOCATION_DRAG_TYPE, String(slot.index));
          e.dataTransfer.effectAllowed = 'move';
        }}
        onDragEnter={onDragEnter}
        onDragOver={(e) => {
          if (editable) e.preventDefault();
        }}
        onDrop={(e) => {
          e.preventDefault();
          onDrop(readDrop(e));
        }}
      >
        <span className="lcd__slot">{slot.slot === 0 ? 'A' : 'B'}</span>
        <span className="lcd__name">{label}</span>
        {slot.isCurrent && <Led state="yellow" />}
      </button>
      <button
        type="button"
        className="tile__more"
        aria-label={`Details for preset ${slot.label}`}
        onClick={onDetails}
      >
        <span aria-hidden="true">⋯</span>
      </button>
    </div>
  );
}

export default function PresetsView() {
  const { state, actions } = useApp();
  const slots = useMemo(() => buildPresetSlots(state), [state]);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const [pending, setPending] = useState<{ index: number; toneprintId: string } | null>(null);

  const librarian = state.link === 'librarian';
  const connected = state.link !== 'disconnected';
  const reading = librarian && state.busy !== null;
  const { details } = state;
  const detailSlot = details?.kind === 'location' ? slots[details.index] : undefined;
  const detailToneprint = details?.kind === 'library' ? state.toneprints[details.id] : undefined;
  const pendingSlot = pending ? slots[pending.index] : undefined;
  const pendingName = pending ? state.toneprints[pending.toneprintId]?.name : undefined;

  const handleDrop = (index: number, dropped: Dropped | null) => {
    setDragOver(null);
    if (!dropped || !librarian) return;
    if (dropped.kind === 'library') setPending({ index, toneprintId: dropped.toneprintId });
    else actions.swapOnPedal(dropped.index, index);
  };

  let intro = 'Connect the pedal to see and change its presets.';
  if (librarian) {
    intro = 'Click a preset to load it. Drag presets to swap them, or drag from the library to '
      + 'put a preset on a location. ⋯ shows details.';
  } else if (connected) {
    intro = 'Connected for MIDI control only: click a preset to load it with Program Change.';
  }

  return (
    <div className="presets-view">
      <div className="view-header">
        <div>
          <h2>Presets</h2>
          <p>{intro}</p>
        </div>
      </div>

      <div className="organizer">
        <LibraryPanel />

        <FillSection title="On the pedal">
          {pending && (
            <div className="warning" role="alert" style={{ marginBottom: '0.8rem' }}>
              {`Put ${pendingName ?? 'the chosen preset'} on ${pendingSlot?.label ?? ''}, `
                + `replacing ${pendingSlot?.name ?? 'the preset there'}?`}
              <div className="button-row">
                <button
                  type="button"
                  className="button button--danger"
                  onClick={() => {
                    actions.loadIntoLocation(pending.index, pending.toneprintId);
                    setPending(null);
                  }}
                >
                  Put on pedal
                </button>
                <button type="button" className="button" onClick={() => setPending(null)}>
                  Cancel
                </button>
              </div>
            </div>
          )}
          {connected ? (
            <div className="board-list scroll-area">
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
                        editable={librarian}
                        dropTarget={librarian && dragOver === slot.index}
                        reading={reading}
                        controlOnly={state.link === 'controlOnly'}
                        onSelect={() => {
                          actions.select(slot.index);
                          actions.recallPreset(slot.index);
                        }}
                        onDetails={() => actions.openDetails({
                          kind: 'location', index: slot.index,
                        })}
                        onDragEnter={() => setDragOver(slot.index)}
                        onDrop={(dropped) => handleDrop(slot.index, dropped)}
                      />
                    ))}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="empty">
              Connect the pedal over USB in the panel on the left. Its 128 preset locations appear
              here. To restore a backup file, go to Backups.
            </p>
          )}
        </FillSection>
      </div>

      {detailSlot && (
        <Modal title={`Preset ${detailSlot.label}`} onClose={actions.closeDetails}>
          <PresetDetails
            key={`${detailSlot.index}:${detailSlot.toneprintId ?? ''}`}
            preset={detailSlot}
            allSlots={slots}
          />
        </Modal>
      )}
      {detailToneprint && (
        <Modal title="Library preset" onClose={actions.closeDetails}>
          <LibraryDetails
            key={detailToneprint.id}
            toneprint={detailToneprint}
            slots={slots}
            canPlace={librarian}
            onPlace={(index) => {
              actions.loadIntoLocation(index, detailToneprint.id);
              actions.closeDetails();
            }}
          />
        </Modal>
      )}
    </div>
  );
}
