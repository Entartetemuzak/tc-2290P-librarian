import {
  type DragEvent, useId, useMemo, useRef, useState,
} from 'react';
import Led from '../components/Led';
import FillSection from '../components/FillSection';
import Modal from '../components/Modal';
import { BOARD_COUNT } from '../protocol/constants';
import { useApp } from '../state/context';
import { LIBRARY_DRAG_TYPE } from '../state/library';
import { type PresetSlot, buildPresetSlots } from '../state/presets';
import LibraryDetails from './LibraryDetails';
import LibraryPanel from './LibraryPanel';
import PresetDetails from './PresetDetails';

interface TileProps {
  slot: PresetSlot;
  selected: boolean;
  draggable: boolean;
  acceptsDrop: boolean;
  dropTarget: boolean;
  reading: boolean;
  onSelect: () => void;
  onDetails: () => void;
  onDragStart: () => void;
  onDragEnter: () => void;
  /** Called with a TonePrint ID when a library preset is dropped, otherwise with null. */
  onDrop: (toneprintId: string | null) => void;
}

function Tile({
  slot, selected, draggable, acceptsDrop, dropTarget, reading,
  onSelect, onDetails, onDragStart, onDragEnter, onDrop,
}: TileProps) {
  const classes = ['lcd'];
  if (!slot.name && !slot.toneprintId) classes.push('lcd--empty');
  if (slot.isCurrent) classes.push('lcd--current');
  if (dropTarget) classes.push('lcd--drop');
  let label = slot.name;
  if (!label && reading) label = 'Reading…';
  if (!label) label = slot.toneprintId ? `ID ${slot.toneprintId.slice(0, 8)}` : 'Empty';
  return (
    <div className="tile">
      <button
        type="button"
        className={classes.join(' ')}
        aria-pressed={selected}
        aria-label={`Preset ${slot.label}: ${label}${slot.isCurrent ? ', active' : ''}`}
        draggable={draggable}
        onClick={onSelect}
        onDragStart={(e) => {
          e.dataTransfer.effectAllowed = 'move';
          onDragStart();
        }}
        onDragEnter={onDragEnter}
        onDragOver={(e: DragEvent) => {
          if (acceptsDrop) e.preventDefault();
        }}
        onDrop={(e: DragEvent) => {
          e.preventDefault();
          onDrop(e.dataTransfer.getData(LIBRARY_DRAG_TYPE) || null);
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
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const [pending, setPending] = useState<{ index: number; toneprintId: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const fileInputId = useId();

  const editingFile = state.source === 'library' && state.library !== null;
  const hasPedal = state.link === 'librarian';
  const writesToPedal = state.source === 'pedal' && hasPedal && state.experimental;
  const canPlace = editingFile || writesToPedal;
  const recallsOnClick = state.source === 'pedal' && state.link !== 'disconnected';
  const readingNames = state.source === 'pedal' && hasPedal && state.busy !== null;
  const nothingToShow = !hasPedal && !state.library;
  const fileName = state.library?.fileName ?? '';
  const { details } = state;
  const detailSlot = details?.kind === 'location' ? slots[details.index] : undefined;
  const detailToneprint = details?.kind === 'library' ? state.toneprints[details.id] : undefined;
  let placeTarget: 'pedal' | 'file' | null = null;
  if (editingFile) placeTarget = 'file';
  else if (writesToPedal) placeTarget = 'pedal';

  const place = (index: number, toneprintId: string) => {
    if (editingFile) actions.replaceInBackup(index, toneprintId);
    else if (writesToPedal) setPending({ index, toneprintId });
  };

  const pendingSlot = pending ? slots[pending.index] : undefined;
  const pendingName = pending ? state.toneprints[pending.toneprintId]?.name : undefined;

  let intro = ' Click a preset for details; drag presets to rearrange the backup file.';
  if (recallsOnClick) intro = ' Click a preset to load it on the pedal; ⋯ shows its details.';

  return (
    <div className="presets-view">
      <div className="view-header">
        <div>
          <h2>Presets</h2>
          <p>
            64 boards, each with preset A and B.
            {intro}
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
            onClick={() => {
              if (state.library) actions.setSource('library');
              else fileInput.current?.click();
            }}
          >
            {state.library ? 'Backup file' : 'Open backup file…'}
          </button>
        </div>
        <input
          ref={fileInput}
          id={fileInputId}
          type="file"
          accept=".tc2290B,application/json"
          className="visually-hidden"
          tabIndex={-1}
          aria-label="Open backup file"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) actions.openBackup(file);
            e.target.value = '';
          }}
        />
      </div>

      <div className="organizer">
        <LibraryPanel />

        <FillSection title={editingFile ? `Backup file: ${fileName}` : 'On the pedal'}>
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
          {nothingToShow ? (
            <p className="empty">
              Connect the pedal over USB and select Connect, or open a backup file. Both show the
              same 128 preset locations here.
            </p>
          ) : (
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
                        draggable={editingFile}
                        acceptsDrop={canPlace}
                        dropTarget={canPlace && dragOver === slot.index && dragFrom !== slot.index}
                        reading={readingNames}
                        onSelect={() => {
                          if (recallsOnClick) {
                            actions.select(slot.index);
                            actions.recallPreset(slot.index);
                          } else {
                            actions.openDetails({ kind: 'location', index: slot.index });
                          }
                        }}
                        onDetails={() => actions.openDetails({
                          kind: 'location', index: slot.index,
                        })}
                        onDragStart={() => setDragFrom(slot.index)}
                        onDragEnter={() => setDragOver(slot.index)}
                        onDrop={(toneprintId) => {
                          if (toneprintId) place(slot.index, toneprintId);
                          else if (dragFrom !== null && editingFile) {
                            actions.swapPresets(dragFrom, slot.index);
                          }
                          setDragFrom(null);
                          setDragOver(null);
                        }}
                      />
                    ))}
                  </div>
                );
              })}
            </div>
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
            placeTarget={placeTarget}
            onPlace={(index) => {
              if (editingFile) actions.replaceInBackup(index, detailToneprint.id);
              else actions.loadIntoLocation(index, detailToneprint.id);
              actions.closeDetails();
            }}
          />
        </Modal>
      )}
    </div>
  );
}
