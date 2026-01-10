/**
 * GitHub Sync Store - GitHub Gist sync state management
 * 
 * Cross-platform sync store that works on both Tauri and Web
 * On Web, sync features are disabled but the store remains functional
 */

import { create } from 'zustand';
import { githubCommands, hasBackendCommands } from '@/lib/tauri/invoke';

export type GithubSyncStatusType = 'idle' | 'pending' | 'syncing' | 'success' | 'error';

interface GithubSyncState {
  isConnected: boolean;
  username: string | null;
  gistId: string | null;
  isSyncing: boolean;
  isConnecting: boolean;
  lastSyncTime: number | null;
  syncError: string | null;
  hasRemoteData: boolean;
  remoteModifiedTime: string | null;
  isLoading: boolean;
  syncStatus: GithubSyncStatusType;
  /** Whether sync features are available on this platform */
  isSyncAvailable: boolean;
}

interface GithubSyncActions {
  checkStatus: () => Promise<void>;
  connect: () => Promise<boolean>;
  disconnect: () => Promise<void>;
  syncToCloud: () => Promise<boolean>;
  syncBidirectional: () => Promise<boolean>;
  restoreFromCloud: () => Promise<boolean>;
  checkRemoteData: () => Promise<void>;
  clearError: () => void;
  setSyncStatus: (status: GithubSyncStatusType) => void;
}

type GithubSyncStore = GithubSyncState & GithubSyncActions;

const initialState: GithubSyncState = {
  isConnected: false,
  username: null,
  gistId: null,
  isSyncing: false,
  isConnecting: false,
  lastSyncTime: null,
  syncError: null,
  hasRemoteData: false,
  remoteModifiedTime: null,
  isLoading: true,
  syncStatus: 'idle',
  isSyncAvailable: hasBackendCommands(),
};

export const useGithubSyncStore = create<GithubSyncStore>((set, get) => ({
  ...initialState,

  checkStatus: async () => {
    set({ isLoading: true });
    
    if (!hasBackendCommands()) {
      set({ isLoading: false, isSyncAvailable: false });
      return;
    }

    try {
      const status = await githubCommands.getGithubSyncStatus();
      if (status) {
        set({
          isConnected: status.connected,
          username: status.username,
          gistId: status.gistId,
          lastSyncTime: status.lastSyncTime,
          hasRemoteData: status.hasRemoteData,
          remoteModifiedTime: status.remoteModifiedTime,
          isLoading: false,
        });

        if (status.connected) {
          get().checkRemoteData();
        }
      }
    } catch (error) {
      console.error('Failed to check GitHub sync status:', error);
      set({ isLoading: false });
    }
  },

  connect: async () => {
    if (!hasBackendCommands()) {
      set({ syncError: 'GitHub sync is not available on this platform' });
      return false;
    }

    set({ isConnecting: true, syncError: null });
    try {
      const result = await githubCommands.githubAuth();

      if (result?.success) {
        set({
          isConnected: true,
          username: result.username,
          isConnecting: false,
        });
        get().checkRemoteData();
        return true;
      } else {
        set({
          syncError: result?.error || 'Authorization failed',
          isConnecting: false,
        });
        return false;
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      set({
        syncError: errorMsg,
        isConnecting: false,
      });
      return false;
    }
  },

  disconnect: async () => {
    if (!hasBackendCommands()) return;

    try {
      await githubCommands.githubDisconnect();
      set({
        isConnected: false,
        username: null,
        gistId: null,
        hasRemoteData: false,
        remoteModifiedTime: null,
        syncError: null,
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      set({ syncError: errorMsg });
    }
  },

  syncToCloud: async () => {
    const state = get();

    if (!hasBackendCommands()) {
      set({ syncError: 'Sync is not available on this platform' });
      return false;
    }

    if (!state.isConnected) {
      set({ syncError: 'Not connected to GitHub' });
      return false;
    }

    set({ isSyncing: true, syncError: null, syncStatus: 'syncing' });
    try {
      const result = await githubCommands.syncToGithub();

      if (result?.success) {
        set({
          lastSyncTime: result.timestamp,
          isSyncing: false,
          hasRemoteData: true,
          syncStatus: 'idle',
        });
        return true;
      } else {
        set({
          syncError: result?.error || 'Sync failed',
          isSyncing: false,
          syncStatus: 'error',
        });
        return false;
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      set({
        syncError: errorMsg,
        isSyncing: false,
        syncStatus: 'error',
      });
      return false;
    }
  },

  syncBidirectional: async () => {
    const state = get();

    if (!hasBackendCommands()) {
      set({ syncError: 'Sync is not available on this platform' });
      return false;
    }

    if (!state.isConnected) {
      set({ syncError: 'Not connected to GitHub' });
      return false;
    }

    set({ isSyncing: true, syncStatus: 'syncing', syncError: null });
    try {
      const result = await githubCommands.syncGithubBidirectional();

      if (result?.success) {
        set({
          lastSyncTime: result.timestamp,
          isSyncing: false,
          hasRemoteData: true,
          syncStatus: 'idle',
        });

        if (result.pulledFromCloud) {
          console.log('[GitHub Sync] Pulled data from cloud, reloading...');
          window.location.reload();
        }

        return true;
      } else {
        set({
          syncError: result?.error || 'Sync failed',
          isSyncing: false,
          syncStatus: 'error',
        });
        return false;
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      set({
        syncError: errorMsg,
        isSyncing: false,
        syncStatus: 'error',
      });
      return false;
    }
  },

  restoreFromCloud: async () => {
    const state = get();

    if (!hasBackendCommands()) {
      set({ syncError: 'Restore is not available on this platform' });
      return false;
    }

    if (!state.isConnected) {
      set({ syncError: 'Not connected to GitHub' });
      return false;
    }

    set({ isSyncing: true, syncError: null, syncStatus: 'syncing' });
    try {
      const result = await githubCommands.restoreFromGithub();

      if (result?.success) {
        set({
          lastSyncTime: result.timestamp,
          isSyncing: false,
          syncStatus: 'idle',
        });
        window.location.reload();
        return true;
      } else {
        set({
          syncError: result?.error || 'Restore failed',
          isSyncing: false,
          syncStatus: 'error',
        });
        return false;
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      set({
        syncError: errorMsg,
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
          gistId: info.gistId,
        });
      }
    } catch (error) {
      console.error('Failed to check GitHub remote data:', error);
    }
  },

  clearError: () => {
    set({ syncError: null });
  },

  setSyncStatus: (status: GithubSyncStatusType) => {
    set({ syncStatus: status });
  },
}));
