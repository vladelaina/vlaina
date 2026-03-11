import type { StoreApi } from 'zustand';
import { hasBackendCommands } from '@/lib/tauri/invoke';
import { githubSyncCommands } from '@/lib/tauri/githubSyncCommands';
import { friendlySyncError } from '@/lib/sync/syncErrors';
import { cancelPendingSave, flushPendingSave } from '@/lib/storage/unifiedStorage';
import { useUnifiedStore } from '../useUnifiedStore';
import type { GithubSyncActions, GithubSyncState, GithubSyncStatusType } from './state';

const SYNC_TIMEOUT_MS = 60000;

type Set = StoreApi<GithubSyncState & GithubSyncActions>['setState'];
type Get = StoreApi<GithubSyncState & GithubSyncActions>['getState'];

function withSyncTimeout<T>(promise: Promise<T>): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Sync timeout')), SYNC_TIMEOUT_MS)
    ),
  ]);
}

async function runConfigSync(
  get: Get,
  set: Set,
  options: {
    unavailableMessage: string;
    startLog: string;
    successLog: (elapsedSeconds: string, result: any) => string;
    execute: () => Promise<any>;
    onSuccess?: (result: any) => Promise<void>;
  }
): Promise<boolean> {
  const state = get();

  if (state.isSyncing) return false;
  if (!hasBackendCommands()) {
    set({ syncError: options.unavailableMessage });
    return false;
  }
  if (!state.isConnected) {
    set({ syncError: 'Not connected to GitHub' });
    return false;
  }

  set({ isSyncing: true, syncError: null, syncStatus: 'syncing' });
  console.log(options.startLog);
  const t0 = performance.now();

  try {
    const result = await withSyncTimeout(options.execute());
    const elapsedSeconds = ((performance.now() - t0) / 1000).toFixed(1);

    if (result?.success) {
      console.log(options.successLog(elapsedSeconds, result));
      set({
        lastSyncTime: result.timestamp,
        isSyncing: false,
        hasRemoteData: true,
        syncStatus: 'idle',
      });
      if (options.onSuccess) {
        await options.onSuccess(result);
      }
      return true;
    }

    console.error(`${options.startLog.replace(' start', ' failed')}:`, result?.error);
    set({
      syncError: friendlySyncError(result?.error || 'Sync failed'),
      isSyncing: false,
      syncStatus: 'error',
    });
    return false;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`${options.startLog.replace(' start', ' error')}:`, errorMsg);
    set({
      syncError: friendlySyncError(errorMsg),
      isSyncing: false,
      syncStatus: 'error',
    });
    return false;
  }
}

export function createGithubConfigSyncActions(
  set: Set,
  get: Get
): Pick<
  GithubSyncActions,
  'syncToCloud' | 'syncBidirectional' | 'restoreFromCloud' | 'checkRemoteData' | 'clearError' | 'setSyncStatus'
> {
  return {
    syncToCloud: async () =>
      runConfigSync(get, set, {
        unavailableMessage: 'Sync is not available on this platform',
        startLog: '[Sync:Config] push start',
        successLog: (elapsedSeconds) => `[Sync:Config] push success ${elapsedSeconds}s`,
        execute: () => githubSyncCommands.syncToGithub(),
      }),

    syncBidirectional: async () =>
      runConfigSync(get, set, {
        unavailableMessage: 'Sync is not available on this platform',
        startLog: '[Sync:Config] bidirectional start',
        successLog: (elapsedSeconds, result) =>
          `[Sync:Config] bidirectional success (pulled: ${result.pulledFromCloud}, pushed: ${result.pushedToCloud}) ${elapsedSeconds}s`,
        execute: () => githubSyncCommands.syncGithubBidirectional(),
        onSuccess: async (result) => {
          if (!result.pulledFromCloud) return;
          await flushPendingSave();
          await useUnifiedStore.getState().reloadFromDisk({ preserveRuntimeChat: true });
        },
      }),

    restoreFromCloud: async () =>
      runConfigSync(get, set, {
        unavailableMessage: 'Restore is not available on this platform',
        startLog: '[Sync:Config] restore start',
        successLog: (elapsedSeconds) => `[Sync:Config] restore success ${elapsedSeconds}s`,
        execute: () => githubSyncCommands.restoreFromGithub(),
        onSuccess: async () => {
          cancelPendingSave();
          await useUnifiedStore.getState().reloadFromDisk();
        },
      }),

    checkRemoteData: async () => {
      if (!hasBackendCommands() || !get().isConnected) return;

      try {
        const info = await githubSyncCommands.checkGithubRemoteData();
        if (info) {
          set({
            hasRemoteData: info.exists,
            remoteModifiedTime: info.modifiedTime,
          });
        }
      } catch (error) {
        console.error('Failed to check GitHub remote data:', error);
      }
    },

    clearError: () => set({ syncError: null }),

    setSyncStatus: (status: GithubSyncStatusType) => {
      set({ syncStatus: status });
    },
  };
}
