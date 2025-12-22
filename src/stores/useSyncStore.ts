/**
 * Sync Store - Google Drive sync state management
 * 
 * Manages connection status, sync operations, and error states
 * for Google Drive integration.
 */

import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { useLicenseStore } from './useLicenseStore';

// Types matching Rust backend
interface SyncStatus {
  connected: boolean;
  userEmail: string | null;
  lastSyncTime: number | null;
  hasRemoteData: boolean;
  remoteModifiedTime: string | null;
  folderId: string | null;
}

interface AuthResult {
  success: boolean;
  userEmail: string | null;
  error: string | null;
}

interface SyncResult {
  success: boolean;
  timestamp: number | null;
  error: string | null;
}

interface RemoteDataInfo {
  exists: boolean;
  modifiedTime: string | null;
  fileId: string | null;
}

// Store state
interface SyncState {
  // Connection state
  isConnected: boolean;
  userEmail: string | null;
  
  // Sync state
  isSyncing: boolean;
  isConnecting: boolean;
  lastSyncTime: number | null;
  syncError: string | null;
  
  // Remote data info
  hasRemoteData: boolean;
  remoteModifiedTime: string | null;
  
  // Loading state
  isLoading: boolean;
  
  // Auto sync (PRO feature)
  autoSyncEnabled: boolean;
}

// Store actions
interface SyncActions {
  // Check current status
  checkStatus: () => Promise<void>;
  
  // Connect to Google Drive
  connect: () => Promise<boolean>;
  
  // Disconnect from Google Drive
  disconnect: () => Promise<void>;
  
  // Sync local data to cloud
  syncToCloud: () => Promise<boolean>;
  
  // Restore data from cloud
  restoreFromCloud: () => Promise<boolean>;
  
  // Check if remote data exists
  checkRemoteData: () => Promise<void>;
  
  // Clear error
  clearError: () => void;
  
  // Toggle auto sync (PRO feature)
  toggleAutoSync: () => boolean;
  
  // Check if user can use auto sync
  canUseAutoSync: () => boolean;
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
  autoSyncEnabled: false,
};

export const useSyncStore = create<SyncStore>((set, get) => ({
  ...initialState,

  checkStatus: async () => {
    set({ isLoading: true });
    try {
      const status = await invoke<SyncStatus>('get_sync_status');
      set({
        isConnected: status.connected,
        userEmail: status.userEmail,
        lastSyncTime: status.lastSyncTime,
        hasRemoteData: status.hasRemoteData,
        remoteModifiedTime: status.remoteModifiedTime,
        isLoading: false,
      });
      
      // If connected, also check remote data
      if (status.connected) {
        get().checkRemoteData();
      }
    } catch (error) {
      console.error('Failed to check sync status:', error);
      set({ isLoading: false });
    }
  },

  connect: async () => {
    set({ isConnecting: true, syncError: null });
    try {
      const result = await invoke<AuthResult>('google_drive_auth');
      
      if (result.success) {
        set({
          isConnected: true,
          userEmail: result.userEmail,
          isConnecting: false,
        });
        // Check remote data after connecting
        get().checkRemoteData();
        return true;
      } else {
        set({
          syncError: result.error || 'Authorization failed',
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
    try {
      await invoke('google_drive_disconnect');
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
    
    // Check connection status - if not connected, try to check status first
    if (!state.isConnected) {
      set({ syncError: 'Not connected to Google Drive' });
      return false;
    }
    
    set({ isSyncing: true, syncError: null });
    try {
      const result = await invoke<SyncResult>('sync_to_drive');
      
      if (result.success) {
        set({
          lastSyncTime: result.timestamp,
          isSyncing: false,
          hasRemoteData: true,
        });
        return true;
      } else {
        set({
          syncError: result.error || 'Sync failed',
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

  restoreFromCloud: async () => {
    const state = get();
    
    if (!state.isConnected) {
      set({ syncError: 'Not connected to Google Drive' });
      return false;
    }
    
    set({ isSyncing: true, syncError: null });
    try {
      const result = await invoke<SyncResult>('restore_from_drive');
      
      if (result.success) {
        set({
          lastSyncTime: result.timestamp,
          isSyncing: false,
        });
        // Reload the page to refresh data
        window.location.reload();
        return true;
      } else {
        set({
          syncError: result.error || 'Restore failed',
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
    if (!get().isConnected) return;
    
    try {
      const info = await invoke<RemoteDataInfo>('check_remote_data');
      set({
        hasRemoteData: info.exists,
        remoteModifiedTime: info.modifiedTime,
      });
    } catch (error) {
      console.error('Failed to check remote data:', error);
    }
  },

  clearError: () => {
    set({ syncError: null });
  },

  toggleAutoSync: () => {
    const isProUser = useLicenseStore.getState().isProUser;
    
    if (!isProUser) {
      set({ syncError: '自动同步是 PRO 功能，请先激活 PRO 会员' });
      return false;
    }
    
    const newValue = !get().autoSyncEnabled;
    set({ autoSyncEnabled: newValue });
    localStorage.setItem('autoSyncEnabled', JSON.stringify(newValue));
    return true;
  },

  canUseAutoSync: () => {
    return useLicenseStore.getState().isProUser;
  },
}));
