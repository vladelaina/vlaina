import { getElectronBridge } from '@/lib/electron/bridge';
import type { OpenDialogOptions, SaveDialogOptions } from '@/lib/storage/dialog';

function getDialogApi() {
  const bridge = getElectronBridge();
  return bridge?.dialog ?? null;
}

export function openDesktopDialog(options: OpenDialogOptions = {}) {
  return getDialogApi()?.open(options as Record<string, unknown>) ?? Promise.resolve(null);
}

export function saveDesktopDialog(options: SaveDialogOptions = {}) {
  return getDialogApi()?.save(options as Record<string, unknown>) ?? Promise.resolve(null);
}

export function showDesktopMessage(
  message: string,
  options: { title?: string; kind?: 'info' | 'warning' | 'error' } = {}
) {
  return getDialogApi()?.message(message, options) ?? Promise.resolve();
}

export function showDesktopConfirm(
  message: string,
  options: { title?: string; kind?: 'info' | 'warning' | 'error' } = {}
) {
  return getDialogApi()?.confirm(message, options) ?? Promise.resolve(false);
}
