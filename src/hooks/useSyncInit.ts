import { useEffect, useRef } from 'react';
import { useGithubSyncStore } from '@/stores/githubSync';
import { hasBackendCommands } from '@/lib/tauri/invoke';
import { getAutoSyncManager } from '@/lib/sync/autoSyncManager';
import { setUnifiedStorageAutoSyncTrigger } from '@/lib/storage/unifiedStorage';

const TOKEN_CHECK_INTERVAL = 4 * 60 * 1000;

export function useSyncInit() {
  const checkStatus = useGithubSyncStore((state) => state.checkStatus);
  const handleOAuthCallback = useGithubSyncStore((state) => state.handleOAuthCallback);
  const isConnected = useGithubSyncStore((state) => state.isConnected);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const oauthHandledRef = useRef(false);

  useEffect(() => {
    setUnifiedStorageAutoSyncTrigger(() => {
      const syncState = useGithubSyncStore.getState();
      if (syncState.isConnected) {
        getAutoSyncManager().triggerSync();
      }
    });

    return () => {
      setUnifiedStorageAutoSyncTrigger(null);
    };
  }, []);

  useEffect(() => {
    if (hasBackendCommands() || oauthHandledRef.current) return;
    oauthHandledRef.current = true;

    const params = new URLSearchParams(window.location.search);
    if (params.has('auth_code')) {
      handleOAuthCallback();
    } else {
      checkStatus();
    }
  }, [handleOAuthCallback, checkStatus]);

  useEffect(() => {
    useGithubSyncStore.getState().hydrateAvatar();
    if (!hasBackendCommands()) return;
    checkStatus();
  }, [checkStatus]);

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (isConnected) {
      intervalRef.current = setInterval(() => {
        checkStatus();
      }, TOKEN_CHECK_INTERVAL);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isConnected, checkStatus]);
}
