import type { StoreApi } from 'zustand';
import type { GithubSyncState, GithubSyncActions, GithubSyncStatusType } from './useGithubSyncStore';
import { GITHUB_USER_PERSIST_KEY } from './useGithubSyncStore';
import { hasBackendCommands } from '@/lib/tauri/invoke';
import { githubCommands } from '@/lib/tauri/githubAuthCommands';
import { webGithubCommands, handleOAuthCallback as parseOAuthCallback } from '@/lib/tauri/webGithubCommands';
import { downloadAndSaveAvatar, getLocalAvatarUrl } from '@/lib/assets/avatarManager';
import { friendlySyncError } from '@/lib/sync/syncErrors';
import { resetAutoSyncManager } from '@/lib/sync/autoSyncManager';

type Set = StoreApi<GithubSyncState & GithubSyncActions>['setState'];
type Get = StoreApi<GithubSyncState & GithubSyncActions>['getState'];

function persistUser(data: { isConnected: boolean; username: string | null; avatarUrl: string | null }) {
  localStorage.setItem(GITHUB_USER_PERSIST_KEY, JSON.stringify(data));
}

export function createCheckStatus(set: Set, get: Get): () => Promise<void> {
  return async () => {
    set({ isLoading: true });

    if (hasBackendCommands()) {
      try {
        const status = await githubCommands.getGithubSyncStatus();
        if (status) {
          set({
            isConnected: status.connected,
            username: status.username,
            avatarUrl: status.avatarUrl,
            configRepoReady: status.configRepoReady,
            lastSyncTime: status.lastSyncTime,
            hasRemoteData: status.hasRemoteData,
            remoteModifiedTime: status.remoteModifiedTime,
            isLoading: false,
          });

          persistUser({
            isConnected: status.connected,
            username: status.username,
            avatarUrl: status.avatarUrl,
          });

          if (status.username) {
            const localSrc = await getLocalAvatarUrl(status.username);
            if (localSrc) set({ localAvatarUrl: localSrc });
          }

          if (status.avatarUrl && status.username) {
            const currentUsername = status.username;
            const currentRemoteUrl = status.avatarUrl;

            downloadAndSaveAvatar(currentRemoteUrl, currentUsername).then(async () => {
              if (get().username === currentUsername) {
                const newLocal = await getLocalAvatarUrl(currentUsername);
                if (newLocal) set({ localAvatarUrl: newLocal });
              }
            }).catch(() => {});
          }

          if (status.connected) {
            get().checkRemoteData();
          }
        }
      } catch (error) {
        console.error('Failed to check GitHub sync status:', error);
        set({ isLoading: false });
      }
    } else {
      const status = webGithubCommands.getStatus();
      set({
        isConnected: status.connected,
        username: status.username,
        avatarUrl: status.avatarUrl,
        lastSyncTime: status.lastSyncTime,
        isLoading: false,
      });

      persistUser({
        isConnected: status.connected,
        username: status.username,
        avatarUrl: status.avatarUrl,
      });

    }
  };
}

export function createConnect(set: Set, get: Get): () => Promise<boolean> {
  return async () => {
    set({ isConnecting: true, syncError: null });

    const timeoutId = setTimeout(() => {
      if (get().isConnecting) {
        set({ isConnecting: false, syncError: null });
      }
    }, 60000);

    (window as any).__nekotick_auth_timeout = timeoutId;

    if (hasBackendCommands()) {
      try {
        const result = await githubCommands.githubAuth();
        clearTimeout(timeoutId);

        if (result?.success) {
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
            }).catch(() => {});
          }

          get().checkRemoteData();
          return true;
        } else {
          set({
            syncError: friendlySyncError(result?.error || 'Authorization failed'),
            isConnecting: false,
          });
          return false;
        }
      } catch (error) {
        clearTimeout(timeoutId);
        const errorMsg = error instanceof Error ? error.message : String(error);
        set({ syncError: friendlySyncError(errorMsg), isConnecting: false });
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
        set({ syncError: friendlySyncError(errorMsg), isConnecting: false });
        return false;
      }
    }
  };
}

export function createHandleOAuthCallback(set: Set, _get: Get): () => Promise<boolean> {
  return async () => {
    if (hasBackendCommands()) return false;

    const callback = parseOAuthCallback();
    if (!callback) return false;

    set({ isConnecting: true, syncError: null });

    const savedState = sessionStorage.getItem('github_oauth_state');
    sessionStorage.removeItem('github_oauth_state');

    if (!savedState || !callback.state || savedState !== callback.state) {
      set({ syncError: 'OAuth state mismatch', isConnecting: false });
      return false;
    }

    const result = await webGithubCommands.exchangeCode(callback.code, callback.state);

    if (result.success && result.username) {
      set({
        isConnected: true,
        username: result.username,
        avatarUrl: result.avatarUrl || null,
        isConnecting: false,
      });

      persistUser({
        isConnected: true,
        username: result.username,
        avatarUrl: result.avatarUrl || null,
      });

      return true;
    } else {
      set({ syncError: friendlySyncError(result.error || 'OAuth failed'), isConnecting: false });
      return false;
    }
  };
}

export function createDisconnect(set: Set, _get: Get): () => Promise<void> {
  return async () => {
    const timeoutId = (window as any).__nekotick_auth_timeout;
    if (timeoutId) {
      clearTimeout(timeoutId);
      (window as any).__nekotick_auth_timeout = null;
    }

    if (hasBackendCommands()) {
      try {
        await githubCommands.githubDisconnect();
      } catch (error) {
        console.error('Backend disconnect failed, forcing local cleanup:', error);
      }
    } else {
      webGithubCommands.disconnect();
    }

    resetAutoSyncManager();

    set({
      isConnected: false,
      isConnecting: false,
      username: null,
      avatarUrl: null,
      localAvatarUrl: null,
      configRepoReady: false,
      hasRemoteData: false,
      remoteModifiedTime: null,
      syncError: null,
      isSyncing: false,
      syncStatus: 'idle' as GithubSyncStatusType,
      lastSyncTime: null,
    });

    localStorage.removeItem(GITHUB_USER_PERSIST_KEY);
  };
}

export function createCancelConnect(set: Set, _get: Get): () => void {
  return () => {
    const timeoutId = (window as any).__nekotick_auth_timeout;
    if (timeoutId) {
      clearTimeout(timeoutId);
      (window as any).__nekotick_auth_timeout = null;
    }
    set({ isConnecting: false, syncError: null });
  };
}
