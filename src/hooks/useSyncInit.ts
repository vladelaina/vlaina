// Sync Init Hook - Initialize sync status on app startup

import { useEffect, useRef } from 'react';
import { useSyncStore } from '@/stores/useSyncStore';
import { useGithubSyncStore } from '@/stores/useGithubSyncStore';
import { useLicenseStore } from '@/stores/useLicenseStore';
import { getAutoSyncManager } from '@/lib/sync/autoSyncManager';
import { STORAGE_KEY_PENDING_SYNC } from '@/lib/config';
import { isTauri } from '@/lib/storage/adapter';

const TOKEN_CHECK_INTERVAL = 4 * 60 * 1000;

export function useSyncInit() {
  const checkStatus = useSyncStore((state) => state.checkStatus);
  const checkGithubStatus = useGithubSyncStore((state) => state.checkStatus);
  const isConnected = useSyncStore((state) => state.isConnected);
  const pendingSync = useSyncStore((state) => state.pendingSync);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasMigratedRef = useRef(false);

  useEffect(() => {
    const init = async () => {
      // Skip Tauri-specific operations in web environment
      if (isTauri() && !hasMigratedRef.current) {
        hasMigratedRef.current = true;
        try {
          const { invoke } = await import('@tauri-apps/api/core');
          const result = await invoke<string>('migrate_credentials');
          if (result === 'migrated') {
            console.log('[Sync] Credentials migrated from keyring to encrypted storage');
          }
        } catch (err) {
          console.error('[Sync] Credential migration failed:', err);
        }
      }
      
      // Check both Google Drive and GitHub sync status
      await Promise.all([
        checkStatus(),
        checkGithubStatus(),
      ]);
      
      const savedPendingSync = localStorage.getItem(STORAGE_KEY_PENDING_SYNC);
      if (savedPendingSync === 'true') {
        useSyncStore.getState().markPendingSync();
      }
    };
    init();
  }, [checkStatus, checkGithubStatus]);

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

  useEffect(() => {
    const handleOnline = () => {
      console.log('[Sync] Network recovered');
      
      const syncState = useSyncStore.getState();
      const licenseState = useLicenseStore.getState();
      
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
