/**
 * GitHub Sync Store - GitHub Gist sync state management
 * 
 * Cross-platform sync store that works on both Tauri and Web
 * On Web, uses API-based OAuth flow instead of local callback server
 */

import { create } from 'zustand';
import { githubCommands, hasBackendCommands, webGithubCommands, handleOAuthCallback } from '@/lib/tauri/invoke';
import { useProStatusStore } from '@/stores/useProStatusStore';

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
  cancelConnect: () => void;
  setSyncStatus: (status: GithubSyncStatusType) => void;
  /** Handle OAuth callback (web only) */
  handleOAuthCallback: () => Promise<boolean>;
}

type GithubSyncStore = GithubSyncState & GithubSyncActions;

const GITHUB_USER_PERSIST_KEY = 'nekotick_github_user_identity';

interface PersistedUser {
  isConnected: boolean;
  username: string | null;
  avatarUrl: string | null;
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
          const newState = {
            isConnected: status.connected,
            username: status.username,
            avatarUrl: status.avatarUrl,
            gistId: status.gistId,
            lastSyncTime: status.lastSyncTime,
            hasRemoteData: status.hasRemoteData,
            remoteModifiedTime: status.remoteModifiedTime,
            isLoading: false,
          };
          set(newState);

          // Persist identity
          localStorage.setItem(GITHUB_USER_PERSIST_KEY, JSON.stringify({
            isConnected: status.connected,
            username: status.username,
            avatarUrl: status.avatarUrl,
          }));

          if (status.connected) {
            try {
              const proStatus = await githubCommands.checkProStatus();
              if (proStatus) {
                useProStatusStore.getState().setProStatus(
                  proStatus.isPro,
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
      const newState = {
        isConnected: status.connected,
        username: status.username,
        avatarUrl: status.avatarUrl,
        gistId: status.gistId,
        lastSyncTime: status.lastSyncTime,
        isLoading: false,
      };
      set(newState);

      // Persist identity
      localStorage.setItem(GITHUB_USER_PERSIST_KEY, JSON.stringify({
        isConnected: status.connected,
        username: status.username,
        avatarUrl: status.avatarUrl,
      }));

      if (status.connected) {
        try {
          const proStatus = await webGithubCommands.checkProStatus();
          useProStatusStore.getState().setProStatus(
            proStatus.isPro,
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

    // 60-second safety timeout (Apple-style: keep it shorter but provide Cancel option)
    const timeoutId = setTimeout(() => {
      const state = get();
      if (state.isConnecting) {
        set({
          isConnecting: false,
          syncError: null // Silently reset on timeout to avoid 'broken' feeling
        });
      }
    }, 60000);

    // Store timeoutId to allow manual cancellation
    (window as any).__nekotick_auth_timeout = timeoutId;

    if (hasBackendCommands()) {
      // Tauri platform - use local OAuth flow
      try {
        const result = await githubCommands.githubAuth();
        clearTimeout(timeoutId);

        if (result?.success) {
          // Set checked status true immediately to avoid flicker
          useProStatusStore.getState().setIsChecking(true);

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
              useProStatusStore.getState().setProStatus(
                proStatus.isPro,
                proStatus.expiresAt ? Math.floor(proStatus.expiresAt / 1000) : null
              );
            } else {
              useProStatusStore.getState().setIsChecking(false);
            }
          } catch (e) {
            console.error('Failed to check PRO status:', e);
            useProStatusStore.getState().setIsChecking(false);
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
        clearTimeout(timeoutId);
        const errorMsg = error instanceof Error ? error.message : String(error);
        set({ syncError: errorMsg, isConnecting: false });
        return false;
      }
    } else {
      // Web platform - use redirect OAuth flow
      try {
        const authData = await webGithubCommands.startAuth();
        clearTimeout(timeoutId);
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
        clearTimeout(timeoutId);
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
      const newState = {
        isConnected: true,
        username: result.username,
        avatarUrl: result.avatarUrl || null,
        isConnecting: false,
      };
      set(newState);

      // Persist identity
      localStorage.setItem(GITHUB_USER_PERSIST_KEY, JSON.stringify({
        isConnected: true,
        username: result.username,
        avatarUrl: result.avatarUrl || null,
      }));

      // Check PRO status
      try {
        const proStatus = await webGithubCommands.checkProStatus();
        useProStatusStore.getState().setProStatus(
          proStatus.isPro,
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

    // Clear persistence
    localStorage.removeItem(GITHUB_USER_PERSIST_KEY);

    useProStatusStore.getState().clearProStatus();
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

  cancelConnect: () => {
    const timeoutId = (window as any).__nekotick_auth_timeout;
    if (timeoutId) {
      clearTimeout(timeoutId);
      (window as any).__nekotick_auth_timeout = null;
    }
    set({ isConnecting: false, syncError: null });
  },

  clearError: () => set({ syncError: null }),

  setSyncStatus: (status: GithubSyncStatusType) => {
    set({ syncStatus: status });
  },
}));
