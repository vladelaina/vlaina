/**
 * GitHub Sync Store - GitHub Gist sync state management
 * 
 * Cross-platform sync store that works on both Tauri and Web
 * On Web, uses API-based OAuth flow instead of local callback server
 */

import { create } from 'zustand';
import { githubCommands, hasBackendCommands, webGithubCommands, handleOAuthCallback } from '@/lib/tauri/invoke';
import { useLicenseStore } from '@/stores/useLicenseStore';

export type GithubSyncStatusType = 'idle' | 'pending' | 'syncing' | 'success' | 'error';

interface GithubSyncState {
  isConnected: boolean;
  username: string | null;
  avatarUrl: string | null;
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
  /** Handle OAuth callback (web only) */
  handleOAuthCallback: () => Promise<boolean>;
}

type GithubSyncStore = GithubSyncState & GithubSyncActions;

const initialState: GithubSyncState = {
  isConnected: false,
  username: null,
  avatarUrl: null,
  gistId: null,
  isSyncing: false,
  isConnecting: false,
  lastSyncTime: null,
  syncError: null,
  hasRemoteData: false,
  remoteModifiedTime: null,
  isLoading: true,
  syncStatus: 'idle',
  // Web platform now also supports login (but sync features are limited)
  isSyncAvailable: true,
};

export const useGithubSyncStore = create<GithubSyncStore>((set, get) => ({
  ...initialState,

  checkStatus: async () => {
    set({ isLoading: true });
    
    if (hasBackendCommands()) {
      // Tauri platform
      try {
        const status = await githubCommands.getGithubSyncStatus();
        if (status) {
          set({
            isConnected: status.connected,
            username: status.username,
            avatarUrl: status.avatarUrl,
            gistId: status.gistId,
            lastSyncTime: status.lastSyncTime,
            hasRemoteData: status.hasRemoteData,
            remoteModifiedTime: status.remoteModifiedTime,
            isLoading: false,
          });

          if (status.connected) {
            try {
              const proStatus = await githubCommands.checkProStatus();
              if (proStatus) {
                useLicenseStore.getState().setProStatus(
                  proStatus.isPro,
                  proStatus.licenseKey,
                  proStatus.expiresAt ? Math.floor(proStatus.expiresAt / 1000) : null
                );
              }
            } catch (e) {
              console.error('Failed to check PRO status:', e);
            }
            get().checkRemoteData();
          }
        }
      } catch (error) {
        console.error('Failed to check GitHub sync status:', error);
        set({ isLoading: false });
      }
    } else {
      // Web platform
      const status = webGithubCommands.getStatus();
      set({
        isConnected: status.connected,
        username: status.username,
        avatarUrl: status.avatarUrl,
        gistId: status.gistId,
        lastSyncTime: status.lastSyncTime,
        isLoading: false,
      });

      if (status.connected) {
        try {
          const proStatus = await webGithubCommands.checkProStatus();
          useLicenseStore.getState().setProStatus(
            proStatus.isPro,
            proStatus.licenseKey,
            proStatus.expiresAt ? Math.floor(proStatus.expiresAt / 1000) : null
          );
        } catch (e) {
          console.error('Failed to check PRO status:', e);
        }
      }
    }
  },

  connect: async () => {
    set({ isConnecting: true, syncError: null });

    if (hasBackendCommands()) {
      // Tauri platform - use local OAuth flow
      try {
        const result = await githubCommands.githubAuth();

        if (result?.success) {
          set({
            isConnected: true,
            username: result.username,
            isConnecting: false,
          });
          
          // Fetch full status including avatar
          await get().checkStatus();
          
          try {
            const proStatus = await githubCommands.checkProStatus();
            if (proStatus) {
              useLicenseStore.getState().setProStatus(
                proStatus.isPro,
                proStatus.licenseKey,
                proStatus.expiresAt ? Math.floor(proStatus.expiresAt / 1000) : null
              );
            }
          } catch (e) {
            console.error('Failed to check PRO status:', e);
          }
          
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
        set({ syncError: errorMsg, isConnecting: false });
        return false;
      }
    } else {
      // Web platform - use redirect OAuth flow
      try {
        const authData = await webGithubCommands.startAuth();
        if (!authData) {
          set({ syncError: 'Failed to start OAuth', isConnecting: false });
          return false;
        }

        // Save state for verification
        sessionStorage.setItem('github_oauth_state', authData.state);
        
        // Redirect to GitHub
        window.location.href = authData.authUrl;
        return true; // Page will redirect, won't reach here
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        set({ syncError: errorMsg, isConnecting: false });
        return false;
      }
    }
  },

  /** Handle OAuth callback from URL (web only) */
  handleOAuthCallback: async () => {
    if (hasBackendCommands()) return false;

    const callback = handleOAuthCallback();
    if (!callback) return false;

    set({ isConnecting: true, syncError: null });

    // Verify state
    const savedState = sessionStorage.getItem('github_oauth_state');
    sessionStorage.removeItem('github_oauth_state');
    
    if (savedState && callback.state && savedState !== callback.state) {
      set({ syncError: 'OAuth state mismatch', isConnecting: false });
      return false;
    }

    // Exchange code
    const result = await webGithubCommands.exchangeCode(callback.code);
    
    if (result.success && result.username) {
      set({
        isConnected: true,
        username: result.username,
        avatarUrl: result.avatarUrl || null,
        isConnecting: false,
      });

      // Check PRO status
      try {
        const proStatus = await webGithubCommands.checkProStatus();
        useLicenseStore.getState().setProStatus(
          proStatus.isPro,
          proStatus.licenseKey,
          proStatus.expiresAt ? Math.floor(proStatus.expiresAt / 1000) : null
        );
      } catch (e) {
        console.error('Failed to check PRO status:', e);
      }

      return true;
    } else {
      set({ syncError: result.error || 'OAuth failed', isConnecting: false });
      return false;
    }
  },

  disconnect: async () => {
    if (hasBackendCommands()) {
      try {
        await githubCommands.githubDisconnect();
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        set({ syncError: errorMsg });
        return;
      }
    } else {
      webGithubCommands.disconnect();
    }

    set({
      isConnected: false,
      username: null,
      avatarUrl: null,
      gistId: null,
      hasRemoteData: false,
      remoteModifiedTime: null,
      syncError: null,
    });
    
    useLicenseStore.getState().clearProStatus();
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
