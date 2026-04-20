import { openDesktopDialog, saveDesktopDialog, showDesktopConfirm, showDesktopMessage } from '@/lib/desktop/dialog';

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
  return openDesktopDialog(options);
}

export async function saveDialog(options: SaveDialogOptions = {}): Promise<string | null> {
  return saveDesktopDialog(options);
}

export async function messageDialog(
  message: string,
  options: { title?: string; kind?: 'info' | 'warning' | 'error' } = {}
): Promise<void> {
  await showDesktopMessage(message, options);
}

export async function confirmDialog(
  message: string,
  options: { title?: string; kind?: 'info' | 'warning' | 'error' } = {}
): Promise<boolean> {
  return showDesktopConfirm(message, options);
}

export function hasNativeDialogs(): boolean {
  return true;
}
