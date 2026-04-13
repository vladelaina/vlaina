import { isTauri } from './adapter';

export interface OpenDialogOptions {
  directory?: boolean;
  multiple?: boolean;
  title?: string;
  defaultPath?: string;
  filters?: { name: string; extensions: string[] }[];
}

export interface SaveDialogOptions {
  title?: string;
  defaultPath?: string;
  filters?: { name: string; extensions: string[] }[];
}

export async function openDialog(options: OpenDialogOptions = {}): Promise<string | string[] | null> {
  if (isTauri()) {
    const { open } = await import('@tauri-apps/plugin-dialog');
    return open(options);
  }
  
  if (options.directory) {
    if (import.meta.env.DEV) console.warn('[Dialog] Directory selection is not supported on web platform');
    return null;
  }
  
  return null;
}

export async function saveDialog(options: SaveDialogOptions = {}): Promise<string | null> {
  if (isTauri()) {
    const { save } = await import('@tauri-apps/plugin-dialog');
    return save(options);
  }
  
  if (import.meta.env.DEV) console.warn('[Dialog] Save dialog is not supported on web platform');
  return null;
}

export async function messageDialog(
  message: string,
  options: { title?: string; kind?: 'info' | 'warning' | 'error' } = {}
): Promise<void> {
  if (isTauri()) {
    const { message: tauriMessage } = await import('@tauri-apps/plugin-dialog');
    await tauriMessage(message, options);
    return;
  }
  
  alert(message);
}

export async function confirmDialog(
  message: string,
  options: { title?: string; kind?: 'info' | 'warning' | 'error' } = {}
): Promise<boolean> {
  if (isTauri()) {
    const { confirm } = await import('@tauri-apps/plugin-dialog');
    return confirm(message, options);
  }
  
  return confirm(message);
}

export function hasNativeDialogs(): boolean {
  return isTauri();
}
