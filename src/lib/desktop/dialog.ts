import { getElectronBridge } from '@/lib/electron/bridge';
import type { OpenDialogOptions, SaveDialogOptions } from '@/lib/storage/dialog';

function getDialogApi() {
  const bridge = getElectronBridge();
  if (!bridge) {
    throw new Error('Electron dialog bridge is not available.');
  }
  return bridge.dialog;
}

export function openDesktopDialog(options: OpenDialogOptions = {}) {
  return getDialogApi().open(options as Record<string, unknown>);
}

export function saveDesktopDialog(options: SaveDialogOptions = {}) {
  return getDialogApi().save(options as Record<string, unknown>);
}

export function showDesktopMessage(
  message: string,
  options: { title?: string; kind?: 'info' | 'warning' | 'error' } = {}
) {
  return getDialogApi().message(message, options);
}

export function showDesktopConfirm(
  message: string,
  options: { title?: string; kind?: 'info' | 'warning' | 'error' } = {}
) {
  return getDialogApi().confirm(message, options);
}
