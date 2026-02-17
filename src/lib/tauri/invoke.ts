import { isTauri } from '@/lib/storage/adapter';

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
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<T>(command, args);
  }

  if (options?.throwOnWeb) {
    throw new Error(options.webErrorMessage || `Command '${command}' is not available on web platform`);
  }

  if (options?.webFallback !== undefined) {
    return options.webFallback;
  }

  console.warn(`[Invoke] Command '${command}' called on web platform, returning undefined`);
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

  async createNewWindow(): Promise<void> {
    if (!isTauri()) {
      window.open(window.location.href, '_blank');
      return;
    }
    await safeInvoke('create_new_window');
  },
};

export { githubCommands } from './githubAuthCommands';
export { githubRepoCommands, type RepositoryInfo, type TreeEntry, type FileContent, type CommitResult } from './githubRepoCommands';
export { gitCommands, type FileStatus, type CommitInfo } from './gitCommands';
export { webGithubCommands, handleOAuthCallback } from './webGithubCommands';
