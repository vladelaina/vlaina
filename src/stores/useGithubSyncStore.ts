import { create } from 'zustand';
import { githubCommands, hasBackendCommands, webGithubCommands, handleOAuthCallback } from '@/lib/tauri/invoke';
import { useProStatusStore } from '@/stores/useProStatusStore';
import { downloadAndSaveAvatar, getLocalAvatarUrl } from '@/lib/assets/avatarManager';

export type GithubSyncStatusType = 'idle' | 'pending' | 'syncing' | 'success' | 'error';

interface GithubSyncState {
  isConnected: boolean;
  username: string | null;
  avatarUrl: string | null;
  localAvatarUrl: string | null;
  gistId: string | null;
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
  handleOAuthCallback: () => Promise<boolean>;
  hydrateAvatar: () => Promise<void>;
}

type GithubSyncStore = GithubSyncState & GithubSyncActions;

const GITHUB_USER_PERSIST_KEY = 'nekotick_github_user_identity';
const PRO_STATUS_ERROR_LOG_COOLDOWN_MS = 60 * 1000;
let lastProStatusErrorLogAt = 0;

function canUseNetwork(): boolean {
  return typeof navigator === 'undefined' || navigator.onLine !== false;
}

function logProStatusError(error: unknown) {
  if (!canUseNetwork()) return;
  const now = Date.now();
  if (now - lastProStatusErrorLogAt < PRO_STATUS_ERROR_LOG_COOLDOWN_MS) return;
  lastProStatusErrorLogAt = now;
  console.warn('Failed to check PRO status:', error);
}

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
  localAvatarUrl: null, // Always init as null, re-fetch on checking status
  gistId: null,
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

  checkStatus: async () => {
    set({ isLoading: true });

    if (hasBackendCommands()) {
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

          localStorage.setItem(GITHUB_USER_PERSIST_KEY, JSON.stringify({
            isConnected: status.connected,
            username: status.username,
            avatarUrl: status.avatarUrl,
          }));

          let localSrc: string | null = null;
          if (status.username) {
            localSrc = await getLocalAvatarUrl(status.username);
            if (localSrc) {
              set({ localAvatarUrl: localSrc });
            }
          }

          if (status.avatarUrl && status.username) {
            const currentUsername = status.username;
            const currentRemoteUrl = status.avatarUrl;

            downloadAndSaveAvatar(currentRemoteUrl, currentUsername).then(async () => {
              if (get().username === currentUsername) {
                const newLocal = await getLocalAvatarUrl(currentUsername);
                if (newLocal) {
                  set({ localAvatarUrl: newLocal });
                }
              }
            });
          }

          if (status.connected && canUseNetwork()) {
            try {
              const proStatus = await githubCommands.checkProStatus();
              if (proStatus) {
                useProStatusStore.getState().setProStatus(
                  proStatus.isPro,
                  proStatus.expiresAt ? Math.floor(proStatus.expiresAt / 1000) : null
                );
              }
            } catch (e) {
              logProStatusError(e);
            }
            get().checkRemoteData();
          }
        }
      } catch (error) {
        console.error('Failed to check GitHub sync status:', error);
        set({ isLoading: false });
      }
    } else {
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

      localStorage.setItem(GITHUB_USER_PERSIST_KEY, JSON.stringify({
        isConnected: status.connected,
        username: status.username,
        avatarUrl: status.avatarUrl,
      }));

      if (status.connected && canUseNetwork()) {
        try {
          const proStatus = await webGithubCommands.checkProStatus();
          useProStatusStore.getState().setProStatus(
            proStatus.isPro,
            proStatus.expiresAt ? Math.floor(proStatus.expiresAt / 1000) : null
          );
        } catch (e) {
          logProStatusError(e);
        }
      }
    }
  },

  connect: async () => {
    set({ isConnecting: true, syncError: null });

    const timeoutId = setTimeout(() => {
      const state = get();
      if (state.isConnecting) {
        set({
          isConnecting: false,
          syncError: null // Silently reset on timeout to avoid 'broken' feeling
        });
      }
    }, 60000);

    (window as any).__nekotick_auth_timeout = timeoutId;

    if (hasBackendCommands()) {
      try {
        const result = await githubCommands.githubAuth();
        clearTimeout(timeoutId);

        if (result?.success) {
          useProStatusStore.getState().setIsChecking(true);

          set({
            isConnected: true,
            username: result.username,
            isConnecting: false,
          });

          await get().checkStatus();

          const currentAvatarUrl = get().avatarUrl;
          const currentUsername = get().username;

          if (currentAvatarUrl && currentUsername) {
            downloadAndSaveAvatar(currentAvatarUrl, currentUsername).then(async () => {
              if (get().username === currentUsername) {
                const newLocal = await getLocalAvatarUrl(currentUsername);
                if (newLocal) set({ localAvatarUrl: newLocal });
              }
            });
          }

          if (canUseNetwork()) {
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
              logProStatusError(e);
              useProStatusStore.getState().setIsChecking(false);
            }
          } else {
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
      try {
        const authData = await webGithubCommands.startAuth();
        clearTimeout(timeoutId);
        if (!authData) {
          set({ syncError: 'Failed to start OAuth', isConnecting: false });
          return false;
        }

        sessionStorage.setItem('github_oauth_state', authData.state);

        window.location.href = authData.authUrl;
        return true;
      } catch (error) {
        clearTimeout(timeoutId);
        const errorMsg = error instanceof Error ? error.message : String(error);
        set({ syncError: errorMsg, isConnecting: false });
        return false;
      }
    }
  },

  handleOAuthCallback: async () => {
    if (hasBackendCommands()) return false;

    const callback = handleOAuthCallback();
    if (!callback) return false;

    set({ isConnecting: true, syncError: null });

    const savedState = sessionStorage.getItem('github_oauth_state');
    sessionStorage.removeItem('github_oauth_state');

    if (savedState && callback.state && savedState !== callback.state) {
      set({ syncError: 'OAuth state mismatch', isConnecting: false });
      return false;
    }

    const result = await webGithubCommands.exchangeCode(callback.code);

    if (result.success && result.username) {
      const newState = {
        isConnected: true,
        username: result.username,
        avatarUrl: result.avatarUrl || null,
        isConnecting: false,
      };
      set(newState);

      localStorage.setItem(GITHUB_USER_PERSIST_KEY, JSON.stringify({
        isConnected: true,
        username: result.username,
        avatarUrl: result.avatarUrl || null,
      }));

      if (canUseNetwork()) {
        try {
          const proStatus = await webGithubCommands.checkProStatus();
          useProStatusStore.getState().setProStatus(
            proStatus.isPro,
            proStatus.expiresAt ? Math.floor(proStatus.expiresAt / 1000) : null
          );
        } catch (e) {
          logProStatusError(e);
        }
      }

      return true;
    } else {
      set({ syncError: result.error || 'OAuth failed', isConnecting: false });
      return false;
    }
  },

  hydrateAvatar: async () => {
    const { username } = get();
    if (username) {
      const localSrc = await getLocalAvatarUrl(username);
      if (localSrc) {
        set({ localAvatarUrl: localSrc });
      }
    }
  },

  disconnect: async () => {
    if (hasBackendCommands()) {
      try {
        await githubCommands.githubDisconnect();
      } catch (error) {
        console.error('Backend disconnect failed, forcing local cleanup:', error);
      }
    } else {
      webGithubCommands.disconnect();
    }

    set({
      isConnected: false,
      username: null,
      avatarUrl: null,
      localAvatarUrl: null,
      gistId: null,
      hasRemoteData: false,
      remoteModifiedTime: null,
      syncError: null,
    });

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
