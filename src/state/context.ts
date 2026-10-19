import { createContext, useContext } from 'react';
import type { AppState, DetailsTarget, ViewId } from './types';

export interface AppActions {
  setView: (view: ViewId) => void;
  enableMidi: () => void;
  choosePorts: (inputId: string, outputId: string) => void;
  connect: () => void;
  disconnect: () => void;
  select: (index: number) => void;
  recallPreset: (index: number) => void;
  sendControl: (controller: number, value: number) => void;
  setDelayTime: (milliseconds: number) => void;
  setChannel: (channel: number) => void;
  openDetails: (target: DetailsTarget) => void;
  closeDetails: () => void;
  /** Puts a remembered preset on a pedal location. */
  loadIntoLocation: (index: number, toneprintId: string) => void;
  /** Swaps the presets on two pedal locations. */
  swapOnPedal: (from: number, to: number) => void;
  /** Stores the preset under a new name (a new TonePrint) on its location. */
  renameOnPedal: (index: number, name: string) => void;
  readPresetNames: () => void;
  forgetPresets: () => void;
  /** Saves everything on the pedal to a .tc2290B file. */
  backUpPedal: () => void;
  openBackup: (file: File) => void;
  closeBackup: () => void;
  /** Writes the open backup file to the pedal. */
  restoreBackup: () => void;
  clearTraffic: () => void;
  dismissNotice: () => void;
}

export interface AppContextValue {
  state: AppState;
  actions: AppActions;
}

export const AppContext = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const value = useContext(AppContext);
  if (!value) throw new Error('useApp must be used inside AppProvider.');
  return value;
}
