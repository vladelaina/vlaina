/**
 * Hook to initialize sync status on app startup
 * 
 * Migrates credentials from keyring to encrypted storage if needed,
 * checks connection status and refreshes tokens if needed.
 * Also sets up periodic token refresh checks and network recovery sync.
 */

import { useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useSyncStore } from '@/stores/useSyncStore';
import { useLicenseStore } from '@/stores/useLicenseStore';
import { getAutoSyncManager } from '@/lib/sync/autoSyncManager';

// Check token status every 4 minutes (tokens expire warning at 5 min)
const TOKEN_CHECK_INTERVAL = 4 * 60 * 1000;

export function useSyncInit() {
  const checkStatus = useSyncStore((state) => state.checkStatus);
  const isConnected = useSyncStore((state) => state.isConnected);
  const pendingSync = useSyncStore((state) => state.pendingSync);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasMigratedRef = useRef(false);

  // Initial migration and status check on app startup
  useEffect(() => {
    const init = async () => {
      // Migrate credentials from keyring to encrypted storage (one-time)
      if (!hasMigratedRef.current) {
        hasMigratedRef.current = true;
        try {
          const result = await invoke<string>('migrate_credentials');
          if (result === 'migrated') {
            console.log('[Sync] Credentials migrated from keyring to encrypted storage');
          }
        } catch (err) {
          console.error('[Sync] Credential migration failed:', err);
        }
      }
      
      // Check status
      await checkStatus();
      
      // Restore pendingSync from localStorage
      const savedPendingSync = localStorage.getItem('pendingSync');
      if (savedPendingSync === 'true') {
        useSyncStore.getState().markPendingSync();
      }
    };
    init();
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

  // Network recovery: sync when coming back online
  useEffect(() => {
    const handleOnline = () => {
      console.log('[Sync] Network recovered');
      
      const syncState = useSyncStore.getState();
      const licenseState = useLicenseStore.getState();
      
      // If there's pending sync and user is PRO, trigger auto-sync
      if (syncState.pendingSync && syncState.isConnected && licenseState.isProUser) {
        console.log('[Sync] Triggering auto-sync after network recovery');
        const autoSyncManager = getAutoSyncManager();
        autoSyncManager.triggerSync();
      }
    };

    window.addEventListener('online', handleOnline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  // Trigger sync on startup if there's pending data (for PRO users)
  useEffect(() => {
    if (pendingSync && isConnected) {
      const licenseState = useLicenseStore.getState();
      if (licenseState.isProUser) {
        console.log('[Sync] Triggering auto-sync for pending data on startup');
        const autoSyncManager = getAutoSyncManager();
        autoSyncManager.triggerSync();
      }
    }
  }, [pendingSync, isConnected]);
}
