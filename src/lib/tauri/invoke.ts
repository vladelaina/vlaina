/**
 * Platform-aware Tauri Invoke Wrapper
 * 
 * Provides safe invoke calls that work on both Tauri and Web platforms
 * On Web, invoke calls return appropriate fallback values or throw errors
 */

import { isTauri } from '@/lib/storage/adapter';

/**
 * Invoke a Tauri command safely
 * 
 * On Tauri: Calls the actual backend command
 * On Web: Returns undefined or throws based on options
 */
export async function safeInvoke<T>(
  command: string,
  args?: Record<string, unknown>,
  options?: {
    /** Value to return on web platform */
    webFallback?: T;
    /** If true, throws an error on web platform */
    throwOnWeb?: boolean;
    /** Custom error message for web platform */
    webErrorMessage?: string;
  }
): Promise<T | undefined> {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    return invoke<T>(command, args);
  }

  // Web platform handling
  if (options?.throwOnWeb) {
    throw new Error(options.webErrorMessage || `Command '${command}' is not available on web platform`);
  }

  if (options?.webFallback !== undefined) {
    return options.webFallback;
  }

  console.warn(`[Invoke] Command '${command}' called on web platform, returning undefined`);
  return undefined;
}

/**
 * Check if Tauri commands are available
 */
export function hasBackendCommands(): boolean {
  return isTauri();
}

/**
 * Window control commands (Tauri only)
 */
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
      // On web, open in new tab
      window.open(window.location.href, '_blank');
      return;
    }
    await safeInvoke('create_new_window');
  },
};

/**
 * GitHub sync commands (Tauri only - requires backend)
 */
export const githubCommands = {
  async getGithubSyncStatus() {
    return safeInvoke<{
      connected: boolean;
      username: string | null;
      gistId: string | null;
      lastSyncTime: number | null;
      hasRemoteData: boolean;
      remoteModifiedTime: string | null;
    }>('get_github_sync_status', undefined, {
      webFallback: {
        connected: false,
        username: null,
        gistId: null,
        lastSyncTime: null,
        hasRemoteData: false,
        remoteModifiedTime: null,
      },
    });
  },

  async githubAuth() {
    return safeInvoke<{
      success: boolean;
      username: string | null;
      error: string | null;
    }>('github_auth', undefined, {
      webFallback: {
        success: false,
        username: null,
        error: 'GitHub sync is not available on web platform',
      },
    });
  },

  async githubDisconnect() {
    return safeInvoke('github_disconnect');
  },

  async syncToGithub() {
    return safeInvoke<{
      success: boolean;
      timestamp: number | null;
      error: string | null;
    }>('sync_to_github', undefined, {
      webFallback: {
        success: false,
        timestamp: null,
        error: 'Sync is not available on web platform',
      },
    });
  },

  async restoreFromGithub() {
    return safeInvoke<{
      success: boolean;
      timestamp: number | null;
      error: string | null;
    }>('restore_from_github', undefined, {
      webFallback: {
        success: false,
        timestamp: null,
        error: 'Restore is not available on web platform',
      },
    });
  },

  async syncGithubBidirectional() {
    return safeInvoke<{
      success: boolean;
      timestamp: number | null;
      pulledFromCloud: boolean;
      pushedToCloud: boolean;
      error: string | null;
    }>('sync_github_bidirectional', undefined, {
      webFallback: {
        success: false,
        timestamp: null,
        pulledFromCloud: false,
        pushedToCloud: false,
        error: 'Sync is not available on web platform',
      },
    });
  },

  async checkGithubRemoteData() {
    return safeInvoke<{
      exists: boolean;
      modifiedTime: string | null;
      gistId: string | null;
    }>('check_github_remote_data', undefined, {
      webFallback: {
        exists: false,
        modifiedTime: null,
        gistId: null,
      },
    });
  },

  async checkProStatus() {
    return safeInvoke<{
      isPro: boolean;
      licenseKey: string | null;
      expiresAt: number | null;
    }>('check_pro_status', undefined, {
      webFallback: {
        isPro: false,
        licenseKey: null,
        expiresAt: null,
      },
    });
  },

  async bindLicenseKey(licenseKey: string) {
    return safeInvoke<{
      isPro: boolean;
      licenseKey: string | null;
      expiresAt: number | null;
    }>('bind_license_key', { licenseKey }, {
      webFallback: {
        isPro: false,
        licenseKey: null,
        expiresAt: null,
      },
    });
  },
};
