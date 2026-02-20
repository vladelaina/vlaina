import { create } from 'zustand';
import { hasBackendCommands } from '@/lib/tauri/invoke';
import { githubCommands } from '@/lib/tauri/githubAuthCommands';
import { friendlySyncError } from '@/lib/sync/syncErrors';
import { flushPendingSave } from '@/lib/storage/unifiedStorage';
import {
  createCheckStatus,
  createConnect,
  createHandleOAuthCallback,
  createDisconnect,
  createCancelConnect,
} from './githubAuthActions';
import { createHydrateAvatar } from './githubAvatarActions';

const SYNC_TIMEOUT_MS = 60000;

function withSyncTimeout<T>(promise: Promise<T>): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Sync timeout')), SYNC_TIMEOUT_MS)
    ),
  ]);
}

export type GithubSyncStatusType = 'idle' | 'pending' | 'syncing' | 'success' | 'error';

export interface GithubSyncState {
  isConnected: boolean;
  username: string | null;
  avatarUrl: string | null;
  localAvatarUrl: string | null;
  configRepoReady: boolean;
  isSyncing: boolean;
  isConnecting: boolean;
  lastSyncTime: number | null;
  syncError: string | null;
  hasRemoteData: boolean;
  remoteModifiedTime: string | null;
  isLoading: boolean;
  syncStatus: GithubSyncStatusType;
  isSyncAvailable: boolean;
}

export interface GithubSyncActions {
  checkStatus: () => Promise<void>;
  connect: () => Promise<boolean>;
  disconnect: () => Promise<void>;
  syncToCloud: () => Promise<boolean>;
  syncBidirectional: () => Promise<boolean>;
  restoreFromCloud: () => Promise<boolean>;
  checkRemoteData: () => Promise<void>;
  clearError: () => void;
  cancelConnect: () => void;
  setSyncStatus: (status: GithubSyncStatusType) => void;
  handleOAuthCallback: () => Promise<boolean>;
  hydrateAvatar: () => Promise<void>;
}

type GithubSyncStore = GithubSyncState & GithubSyncActions;

export const GITHUB_USER_PERSIST_KEY = 'nekotick_github_user_identity';

interface PersistedUser {
  isConnected: boolean;
  username: string | null;
  avatarUrl: string | null;
  localAvatarUrl?: string | null;
}

function getPersistedUser(): PersistedUser {
  try {
    const stored = localStorage.getItem(GITHUB_USER_PERSIST_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Failed to load persisted GitHub user:', e);
  }
  return { isConnected: false, username: null, avatarUrl: null };
}

const persisted = getPersistedUser();

const initialState: GithubSyncState = {
  isConnected: persisted.isConnected,
  username: persisted.username,
  avatarUrl: persisted.avatarUrl,
  localAvatarUrl: null,
  configRepoReady: false,
  isSyncing: false,
  isConnecting: false,
  lastSyncTime: null,
  syncError: null,
  hasRemoteData: false,
  remoteModifiedTime: null,
  isLoading: true,
  syncStatus: 'idle',
  isSyncAvailable: true,
};

export const useGithubSyncStore = create<GithubSyncStore>((set, get) => ({
  ...initialState,

  checkStatus: createCheckStatus(set, get),
  connect: createConnect(set, get),
  handleOAuthCallback: createHandleOAuthCallback(set, get),
  disconnect: createDisconnect(set, get),
  cancelConnect: createCancelConnect(set, get),
  hydrateAvatar: createHydrateAvatar(set, get),

  syncToCloud: async () => {
    const state = get();

    if (state.isSyncing) return false;

    if (!hasBackendCommands()) {
      set({ syncError: 'Sync is not available on this platform' });
      return false;
    }

    if (!state.isConnected) {
      set({ syncError: 'Not connected to GitHub' });
      return false;
    }

    set({ isSyncing: true, syncError: null, syncStatus: 'syncing' });
    console.log('[Sync:Config] push start');
    const t0 = performance.now();
    try {
      const result = await withSyncTimeout(githubCommands.syncToGithub());

      if (result?.success) {
        console.log(`[Sync:Config] push success ${((performance.now() - t0) / 1000).toFixed(1)}s`);
        set({
          lastSyncTime: result.timestamp,
          isSyncing: false,
          hasRemoteData: true,
          syncStatus: 'idle',
        });
        return true;
      } else {
        console.error(`[Sync:Config] push failed:`, result?.error);
        set({
          syncError: friendlySyncError(result?.error || 'Sync failed'),
          isSyncing: false,
          syncStatus: 'error',
        });
        return false;
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`[Sync:Config] push error:`, errorMsg);
      set({
        syncError: friendlySyncError(errorMsg),
        isSyncing: false,
        syncStatus: 'error',
      });
      return false;
    }
  },

  syncBidirectional: async () => {
    const state = get();

    if (state.isSyncing) return false;

    if (!hasBackendCommands()) {
      set({ syncError: 'Sync is not available on this platform' });
      return false;
    }

    if (!state.isConnected) {
      set({ syncError: 'Not connected to GitHub' });
      return false;
    }

    set({ isSyncing: true, syncStatus: 'syncing', syncError: null });
    console.log('[Sync:Config] bidirectional start');
    const t0 = performance.now();
    try {
      const result = await withSyncTimeout(githubCommands.syncGithubBidirectional());

      if (result?.success) {
        console.log(`[Sync:Config] bidirectional success (pulled: ${result.pulledFromCloud}, pushed: ${result.pushedToCloud}) ${((performance.now() - t0) / 1000).toFixed(1)}s`);
        set({
          lastSyncTime: result.timestamp,
          isSyncing: false,
          hasRemoteData: true,
          syncStatus: 'idle',
        });

        if (result.pulledFromCloud) {
          await flushPendingSave();
          window.location.reload();
        }

        return true;
      } else {
        console.error(`[Sync:Config] bidirectional failed:`, result?.error);
        set({
          syncError: friendlySyncError(result?.error || 'Sync failed'),
          isSyncing: false,
          syncStatus: 'error',
        });
        return false;
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`[Sync:Config] bidirectional error:`, errorMsg);
      set({
        syncError: friendlySyncError(errorMsg),
        isSyncing: false,
        syncStatus: 'error',
      });
      return false;
    }
  },

  restoreFromCloud: async () => {
    const state = get();

    if (state.isSyncing) return false;

    if (!hasBackendCommands()) {
      set({ syncError: 'Restore is not available on this platform' });
      return false;
    }

    if (!state.isConnected) {
      set({ syncError: 'Not connected to GitHub' });
      return false;
    }

    set({ isSyncing: true, syncError: null, syncStatus: 'syncing' });
    console.log('[Sync:Config] restore start');
    const t0 = performance.now();
    try {
      const result = await withSyncTimeout(githubCommands.restoreFromGithub());

      if (result?.success) {
        console.log(`[Sync:Config] restore success ${((performance.now() - t0) / 1000).toFixed(1)}s`);
        set({
          lastSyncTime: result.timestamp,
          isSyncing: false,
          syncStatus: 'idle',
        });
        await flushPendingSave();
        window.location.reload();
        return true;
      } else {
        console.error(`[Sync:Config] restore failed:`, result?.error);
        set({
          syncError: friendlySyncError(result?.error || 'Restore failed'),
          isSyncing: false,
          syncStatus: 'error',
        });
        return false;
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`[Sync:Config] restore error:`, errorMsg);
      set({
        syncError: friendlySyncError(errorMsg),
        isSyncing: false,
        syncStatus: 'error',
      });
      return false;
    }
  },

  checkRemoteData: async () => {
    if (!hasBackendCommands() || !get().isConnected) return;

    try {
      const info = await githubCommands.checkGithubRemoteData();
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
}));
