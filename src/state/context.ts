import { createContext, useContext } from 'react';
import type { AppState, PresetSource, ViewId } from './types';

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
  setSource: (source: PresetSource) => void;
  openBackup: (file: File) => void;
  closeBackup: () => void;
  renamePreset: (index: number, name: string) => void;
  swapPresets: (from: number, to: number) => void;
  saveBackup: () => void;
  setExperimental: (enabled: boolean) => void;
  readToneprints: () => void;
  writeBackupToPedal: () => void;
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
