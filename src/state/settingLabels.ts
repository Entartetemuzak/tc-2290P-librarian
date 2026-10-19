import type { Setting } from '../protocol/model';

/** Labels as the official app shows them, where there is one. */
export const KEY_LABELS: Record<string, string> = {
  tempo: 'Tempo',
  bypassMode: 'Bypass mode',
  exprPedalCalibrationMode: 'Expression calibration mode',
  exprPedalMin: 'Expression pedal minimum',
  exprPedalMax: 'Expression pedal maximum',
  externalType: 'External input type',
  serialNumber: 'Serial number',
  softwareVersion: 'Firmware version',
  productName: 'Product name',
  channelIn: 'MIDI channel in',
  channelOut: 'MIDI channel out',
  midiOutFunction: 'MIDI out function',
  receive: 'MIDI clock receive',
  transmit: 'MIDI clock transmit',
  currentBoard: 'Current board',
  currentSlot: 'Current preset',
  monoStereoMode: 'Mono/stereo mode',
  exprPedalInserted: 'Expression pedal connected',
  extLoopInserted: 'External loop connected',
  tapTempo: 'Tap tempo',
};

export function displayValue(setting: Setting): string {
  const allowed = setting.allowedValues.find((a) => a.value === setting.value)?.name;
  if (allowed) return allowed;
  if (setting.key === 'currentSlot') return setting.value === '1' ? 'B' : 'A';
  return setting.value;
}

export function settingLabel(setting: Setting): string {
  return KEY_LABELS[setting.key] || setting.descriptionShort || setting.key;
}
