// Sync Init Hook - Initialize GitHub sync status on app startup

import { useEffect, useRef } from 'react';
import { useGithubSyncStore } from '@/stores/useGithubSyncStore';
import { hasBackendCommands } from '@/lib/tauri/invoke';

const TOKEN_CHECK_INTERVAL = 4 * 60 * 1000;

export function useSyncInit() {
  const checkStatus = useGithubSyncStore((state) => state.checkStatus);
  const handleOAuthCallback = useGithubSyncStore((state) => state.handleOAuthCallback);
  const isConnected = useGithubSyncStore((state) => state.isConnected);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const oauthHandledRef = useRef(false);

  // Handle OAuth callback on web platform (runs once)
  useEffect(() => {
    if (hasBackendCommands() || oauthHandledRef.current) return;
    oauthHandledRef.current = true;

    // Check if URL has OAuth callback params
    const params = new URLSearchParams(window.location.search);
    if (params.has('auth_code')) {
      handleOAuthCallback();
    } else {
      checkStatus();
    }
  }, [handleOAuthCallback, checkStatus]);

  // Check status on Tauri platform
  useEffect(() => {
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
