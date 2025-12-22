/**
 * Hook to initialize sync status on app startup
 * 
 * Checks connection status and refreshes tokens if needed.
 * Also sets up periodic token refresh checks.
 */

import { useEffect, useRef } from 'react';
import { useSyncStore } from '@/stores/useSyncStore';

// Check token status every 4 minutes (tokens expire warning at 5 min)
const TOKEN_CHECK_INTERVAL = 4 * 60 * 1000;

export function useSyncInit() {
  const checkStatus = useSyncStore((state) => state.checkStatus);
  const isConnected = useSyncStore((state) => state.isConnected);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Initial status check on app startup
  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  // Set up periodic token refresh when connected
  useEffect(() => {
    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Only set up interval if connected
    if (isConnected) {
      intervalRef.current = setInterval(() => {
        // checkStatus will trigger token refresh in backend if needed
        checkStatus();
      }, TOKEN_CHECK_INTERVAL);
    }

    // Cleanup on unmount or when connection status changes
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isConnected, checkStatus]);
}
