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
 * Sync commands (Tauri only - requires backend)
 */
export const syncCommands = {
  async getSyncStatus() {
    return safeInvoke<{
      connected: boolean;
      userEmail: string | null;
      lastSyncTime: number | null;
      hasRemoteData: boolean;
      remoteModifiedTime: string | null;
      folderId: string | null;
    }>('get_sync_status', undefined, {
      webFallback: {
        connected: false,
        userEmail: null,
        lastSyncTime: null,
        hasRemoteData: false,
        remoteModifiedTime: null,
        folderId: null,
      },
    });
  },

  async googleDriveAuth() {
    return safeInvoke<{
      success: boolean;
      userEmail: string | null;
      error: string | null;
    }>('google_drive_auth', undefined, {
      webFallback: {
        success: false,
        userEmail: null,
        error: 'Google Drive sync is not available on web platform',
      },
    });
  },

  async googleDriveDisconnect() {
    return safeInvoke('google_drive_disconnect');
  },

  async syncToDrive() {
    return safeInvoke<{
      success: boolean;
      timestamp: number | null;
      error: string | null;
    }>('sync_to_drive', undefined, {
      webFallback: {
        success: false,
        timestamp: null,
        error: 'Sync is not available on web platform',
      },
    });
  },

  async syncBidirectional() {
    return safeInvoke<{
      success: boolean;
      timestamp: number | null;
      pulledFromCloud: boolean;
      pushedToCloud: boolean;
      error: string | null;
    }>('sync_bidirectional', undefined, {
      webFallback: {
        success: false,
        timestamp: null,
        pulledFromCloud: false,
        pushedToCloud: false,
        error: 'Sync is not available on web platform',
      },
    });
  },

  async restoreFromDrive() {
    return safeInvoke<{
      success: boolean;
      timestamp: number | null;
      error: string | null;
    }>('restore_from_drive', undefined, {
      webFallback: {
        success: false,
        timestamp: null,
        error: 'Restore is not available on web platform',
      },
    });
  },

  async checkRemoteData() {
    return safeInvoke<{
      exists: boolean;
      modifiedTime: string | null;
      fileId: string | null;
    }>('check_remote_data', undefined, {
      webFallback: {
        exists: false,
        modifiedTime: null,
        fileId: null,
      },
    });
  },

  async autoSyncToDrive() {
    return safeInvoke<{
      success: boolean;
      timestamp: number | null;
      pulledFromCloud: boolean;
      pushedToCloud: boolean;
      error: string | null;
    }>('auto_sync_to_drive', undefined, {
      webFallback: {
        success: false,
        timestamp: null,
        pulledFromCloud: false,
        pushedToCloud: false,
        error: 'Auto sync is not available on web platform',
      },
    });
  },
};

/**
 * License commands (Tauri only - requires backend)
 */
export const licenseCommands = {
  async ensureTrial() {
    return safeInvoke('ensure_trial');
  },

  async deactivateLicense() {
    return safeInvoke('deactivate_license');
  },
};
