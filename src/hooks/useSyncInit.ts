import { useEffect, useRef } from 'react';
import { useAccountSessionStore } from '@/stores/accountSession';
import { hasBackendCommands } from '@/lib/desktop/backend';

const TOKEN_CHECK_INTERVAL = 4 * 60 * 1000;

export function useSyncInit() {
  const checkStatus = useAccountSessionStore((state) => state.checkStatus);
  const handleAuthCallback = useAccountSessionStore((state) => state.handleAuthCallback);
  const isConnected = useAccountSessionStore((state) => state.isConnected);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const authHandledRef = useRef(false);

  useEffect(() => {
    if (hasBackendCommands() || authHandledRef.current) return;
    authHandledRef.current = true;

    const run = async () => {
      const handled = await handleAuthCallback();
      if (!handled) {
        await checkStatus();
      }
    };

    const params = new URLSearchParams(window.location.search);
    if (params.has('auth_state') || params.has('auth_error') || params.has('auth_provider')) {
      void run();
      return;
    }

    void checkStatus();
  }, [handleAuthCallback, checkStatus]);

  useEffect(() => {
    void useAccountSessionStore.getState().hydrateAvatar();
    if (!hasBackendCommands()) return;
    void checkStatus();
  }, [checkStatus]);

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (isConnected) {
      intervalRef.current = setInterval(() => {
        void checkStatus();
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
