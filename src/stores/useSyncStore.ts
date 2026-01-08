/**
 * Sync Store - Google Drive sync state management
 * 
 * Cross-platform sync store that works on both Tauri and Web
 * On Web, sync features are disabled but the store remains functional
 */

import { create } from 'zustand';
import { syncCommands, hasBackendCommands } from '@/lib/tauri/invoke';
import { useLicenseStore } from './useLicenseStore';
import { STORAGE_KEY_PENDING_SYNC } from '@/lib/config';

export type SyncStatusType = 'idle' | 'pending' | 'syncing' | 'success' | 'error';

interface SyncState {
  isConnected: boolean;
  userEmail: string | null;
  isSyncing: boolean;
  isConnecting: boolean;
  lastSyncTime: number | null;
  syncError: string | null;
  hasRemoteData: boolean;
  remoteModifiedTime: string | null;
  isLoading: boolean;
  pendingSync: boolean;
  lastSyncAttempt: number | null;
  syncRetryCount: number;
  syncStatus: SyncStatusType;
  /** Whether sync features are available on this platform */
  isSyncAvailable: boolean;
}

interface SyncActions {
  checkStatus: () => Promise<void>;
  connect: () => Promise<boolean>;
  disconnect: () => Promise<void>;
  syncToCloud: () => Promise<boolean>;
  syncBidirectional: () => Promise<boolean>;
  restoreFromCloud: () => Promise<boolean>;
  checkRemoteData: () => Promise<void>;
  clearError: () => void;
  markPendingSync: () => void;
  clearPendingSync: () => void;
  setSyncStatus: (status: SyncStatusType) => void;
  incrementRetryCount: () => void;
  resetRetryCount: () => void;
  performAutoSync: () => Promise<boolean>;
}

type SyncStore = SyncState & SyncActions;

const initialState: SyncState = {
  isConnected: false,
  userEmail: null,
  isSyncing: false,
  isConnecting: false,
  lastSyncTime: null,
  syncError: null,
  hasRemoteData: false,
  remoteModifiedTime: null,
  isLoading: true,
  pendingSync: false,
  lastSyncAttempt: null,
  syncRetryCount: 0,
  syncStatus: 'idle',
  isSyncAvailable: hasBackendCommands(),
};

export const useSyncStore = create<SyncStore>((set, get) => ({
  ...initialState,

  checkStatus: async () => {
    set({ isLoading: true });
    
    if (!hasBackendCommands()) {
      set({ isLoading: false, isSyncAvailable: false });
      return;
    }

    try {
      const status = await syncCommands.getSyncStatus();
      if (status) {
        set({
          isConnected: status.connected,
          userEmail: status.userEmail,
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
      console.error('Failed to check sync status:', error);
      set({ isLoading: false });
    }
  },

  connect: async () => {
    if (!hasBackendCommands()) {
      set({ syncError: 'Sync is not available on this platform' });
      return false;
    }

    set({ isConnecting: true, syncError: null });
    try {
      const result = await syncCommands.googleDriveAuth();

      if (result?.success) {
        set({
          isConnected: true,
          userEmail: result.userEmail,
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
      await syncCommands.googleDriveDisconnect();
      set({
        isConnected: false,
        userEmail: null,
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
      set({ syncError: 'Not connected to Google Drive' });
      return false;
    }

    set({ isSyncing: true, syncError: null });
    try {
      const result = await syncCommands.syncToDrive();

      if (result?.success) {
        set({
          lastSyncTime: result.timestamp,
          isSyncing: false,
          hasRemoteData: true,
        });
        return true;
      } else {
        set({
          syncError: result?.error || 'Sync failed',
          isSyncing: false,
        });
        return false;
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      set({
        syncError: errorMsg,
        isSyncing: false,
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
      set({ syncError: 'Not connected to Google Drive' });
      return false;
    }

    set({ isSyncing: true, syncStatus: 'syncing', syncError: null });
    try {
      const result = await syncCommands.syncBidirectional();

      if (result?.success) {
        set({
          lastSyncTime: result.timestamp,
          isSyncing: false,
          hasRemoteData: true,
          pendingSync: false,
          syncStatus: 'idle',
        });
        localStorage.removeItem(STORAGE_KEY_PENDING_SYNC);

        if (result.pulledFromCloud) {
          console.log('[Sync] Pulled data from cloud, reloading...');
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
      set({ syncError: 'Not connected to Google Drive' });
      return false;
    }

    set({ isSyncing: true, syncError: null });
    try {
      const result = await syncCommands.restoreFromDrive();

      if (result?.success) {
        set({
          lastSyncTime: result.timestamp,
          isSyncing: false,
        });
        window.location.reload();
        return true;
      } else {
        set({
          syncError: result?.error || 'Restore failed',
          isSyncing: false,
        });
        return false;
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      set({
        syncError: errorMsg,
        isSyncing: false,
      });
      return false;
    }
  },

  checkRemoteData: async () => {
    if (!hasBackendCommands() || !get().isConnected) return;

    try {
      const info = await syncCommands.checkRemoteData();
      if (info) {
        set({
          hasRemoteData: info.exists,
          remoteModifiedTime: info.modifiedTime,
        });
      }
    } catch (error) {
      console.error('Failed to check remote data:', error);
    }
  },

  clearError: () => {
    set({ syncError: null });
  },

  markPendingSync: () => {
    set({ pendingSync: true, syncStatus: 'pending' });
    localStorage.setItem(STORAGE_KEY_PENDING_SYNC, 'true');
  },

  clearPendingSync: () => {
    set({ pendingSync: false, syncStatus: 'idle' });
    localStorage.removeItem(STORAGE_KEY_PENDING_SYNC);
  },

  setSyncStatus: (status: SyncStatusType) => {
    set({ syncStatus: status });
  },

  incrementRetryCount: () => {
    set((state) => ({ syncRetryCount: state.syncRetryCount + 1 }));
  },

  resetRetryCount: () => {
    set({ syncRetryCount: 0 });
  },

  performAutoSync: async () => {
    const state = get();

    if (!hasBackendCommands()) {
      console.log('[AutoSync] Not available on this platform');
      return false;
    }

    if (!state.isConnected) {
      console.log('[AutoSync] Not connected to Google Drive');
      return false;
    }

    if (state.isSyncing) {
      console.log('[AutoSync] Sync already in progress');
      return false;
    }

    const { isProUser, timeTamperDetected } = useLicenseStore.getState();
    if (!isProUser) {
      console.log('[AutoSync] Not a PRO user');
      return false;
    }

    if (timeTamperDetected) {
      console.log('[AutoSync] Time tamper detected');
      return false;
    }

    set({ isSyncing: true, syncStatus: 'syncing', syncError: null, lastSyncAttempt: Date.now() });

    try {
      const result = await syncCommands.autoSyncToDrive();

      if (result?.success) {
        set({
          lastSyncTime: result.timestamp,
          isSyncing: false,
          hasRemoteData: true,
          pendingSync: false,
          syncStatus: 'idle',
          syncRetryCount: 0,
        });
        localStorage.removeItem(STORAGE_KEY_PENDING_SYNC);

        if (result.pulledFromCloud) {
          console.log('[AutoSync] Pulled data from cloud, reloading...');
          window.location.reload();
        } else {
          console.log('[AutoSync] Sync successful');
        }
        return true;
      } else {
        set({
          syncError: result?.error || 'Auto sync failed',
          isSyncing: false,
          syncStatus: 'error',
        });
        console.error('[AutoSync] Sync failed:', result?.error);
        return false;
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      set({
        syncError: errorMsg,
        isSyncing: false,
        syncStatus: 'error',
      });
      console.error('[AutoSync] Sync error:', errorMsg);
      return false;
    }
  },
}));
