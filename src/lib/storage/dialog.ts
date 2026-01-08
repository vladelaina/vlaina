/**
 * Cross-platform Dialog Utilities
 * 
 * Provides file/folder selection dialogs that work on both Tauri and Web
 */

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

/**
 * Open a file/folder selection dialog
 * 
 * On Tauri: Uses native file dialog
 * On Web: Returns null (web doesn't support folder selection via dialog)
 */
export async function openDialog(options: OpenDialogOptions = {}): Promise<string | string[] | null> {
  if (isTauri()) {
    const { open } = await import('@tauri-apps/plugin-dialog');
    return open(options);
  }
  
  // Web: File input for files, null for directories
  if (options.directory) {
    // Web doesn't support directory selection via standard APIs
    // Return null to indicate unsupported
    console.warn('[Dialog] Directory selection is not supported on web platform');
    return null;
  }
  
  // For file selection on web, we could use <input type="file">
  // but that's typically handled differently in React components
  return null;
}

/**
 * Open a save file dialog
 * 
 * On Tauri: Uses native save dialog
 * On Web: Returns null (handled via download)
 */
export async function saveDialog(options: SaveDialogOptions = {}): Promise<string | null> {
  if (isTauri()) {
    const { save } = await import('@tauri-apps/plugin-dialog');
    return save(options);
  }
  
  // Web: Save is typically handled via download
  console.warn('[Dialog] Save dialog is not supported on web platform');
  return null;
}

/**
 * Show a message dialog
 */
export async function messageDialog(
  message: string,
  options: { title?: string; kind?: 'info' | 'warning' | 'error' } = {}
): Promise<void> {
  if (isTauri()) {
    const { message: tauriMessage } = await import('@tauri-apps/plugin-dialog');
    await tauriMessage(message, options);
    return;
  }
  
  // Web: Use browser alert
  alert(message);
}

/**
 * Show a confirmation dialog
 */
export async function confirmDialog(
  message: string,
  options: { title?: string; kind?: 'info' | 'warning' | 'error' } = {}
): Promise<boolean> {
  if (isTauri()) {
    const { confirm } = await import('@tauri-apps/plugin-dialog');
    return confirm(message, options);
  }
  
  // Web: Use browser confirm
  return confirm(message);
}

/**
 * Check if native dialogs are available
 */
export function hasNativeDialogs(): boolean {
  return isTauri();
}
