import { isTauri } from '@/lib/storage/adapter';
import { invoke } from '@tauri-apps/api/core';
import { buildWindowLaunchSearch } from './windowLaunchContext';

export async function safeInvoke<T>(
  command: string,
  args?: Record<string, unknown>,
  options?: {
    webFallback?: T;
    throwOnWeb?: boolean;
    webErrorMessage?: string;
  }
): Promise<T | undefined> {
  if (isTauri()) {
    return invoke<T>(command, args);
  }

  if (options?.throwOnWeb) {
    throw new Error(options.webErrorMessage || `Command '${command}' is not available on web platform`);
  }

  if (options?.webFallback !== undefined) {
    return options.webFallback;
  }

  if (import.meta.env.DEV) console.warn(`[Invoke] Command '${command}' called on web platform, returning undefined`);
  return undefined;
}

export function hasBackendCommands(): boolean {
  return isTauri();
}

export const windowCommands = {
  async setResizable(resizable: boolean): Promise<void> {
    if (!isTauri()) return;
    await safeInvoke('set_window_resizable', { resizable });
  },

  async toggleFullscreen(): Promise<void> {
    if (!isTauri()) return;
    await safeInvoke('toggle_fullscreen');
  },

  async focusWindow(label: string): Promise<void> {
    if (!isTauri()) return;
    await safeInvoke('focus_window', { label });
  },

  async createNewWindow(options?: {
    vaultPath?: string | null;
    notePath?: string | null;
  }): Promise<void> {
    if (!isTauri()) {
      const nextUrl = new URL(window.location.href);
      nextUrl.search = buildWindowLaunchSearch(options);
      window.open(nextUrl.toString(), '_blank');
      return;
    }
    await safeInvoke('create_new_window', options);
  },
};

export { webAccountCommands, handleAuthCallback } from './webAccountCommands';
