// Sync Init Hook - Initialize GitHub sync status on app startup

import { useEffect, useRef } from 'react';
import { useGithubSyncStore } from '@/stores/useGithubSyncStore';

const TOKEN_CHECK_INTERVAL = 4 * 60 * 1000;

export function useSyncInit() {
  const checkStatus = useGithubSyncStore((state) => state.checkStatus);
  const isConnected = useGithubSyncStore((state) => state.isConnected);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
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
