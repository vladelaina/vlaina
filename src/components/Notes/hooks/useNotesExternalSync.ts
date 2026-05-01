import { useEffect, useRef, useSyncExternalStore } from 'react';
import { watchDesktopPath } from '@/lib/desktop/watch';
import { useNotesStore } from '@/stores/notes/useNotesStore';
import {
  isExternalSyncPaused,
  registerExternalSyncWatcher,
  subscribeExternalSyncPause,
} from '@/stores/notes/document/externalSyncControl';
import { type PendingRenameEntry } from './notesExternalRenameQueue';
import {
  getExternalWatchErrorMessage,
  isExternalWatchUnavailableError,
} from './externalWatchErrorUtils';
import { createNotesExternalSyncActions } from './notesExternalSyncActions';

const NOTES_RECONCILE_POLL_MS = 1500;

function shouldAvoidRecursiveNativeWatch(path: string) {
  const normalized = path.replace(/\\/g, '/').replace(/\/+$/, '');
  if (!normalized) {
    return true;
  }

  if (normalized === '/' || /^[a-z]:$/i.test(normalized)) {
    return true;
  }

  return (
    /^\/home\/[^/]+$/i.test(normalized) ||
    /^\/users\/[^/]+$/i.test(normalized) ||
    /^[a-z]:\/users\/[^/]+$/i.test(normalized)
  );
}

export function useNotesExternalSync(vaultPath: string | null, notesPath: string) {
  const isPaused = useSyncExternalStore(
    subscribeExternalSyncPause,
    isExternalSyncPaused,
    () => false
  );
  const loadFileTree = useNotesStore((state) => state.loadFileTree);
  const invalidateNoteCache = useNotesStore((state) => state.invalidateNoteCache);
  const syncCurrentNoteFromDisk = useNotesStore((state) => state.syncCurrentNoteFromDisk);
  const applyExternalPathRename = useNotesStore((state) => state.applyExternalPathRename);
  const applyExternalPathDeletion = useNotesStore((state) => state.applyExternalPathDeletion);

  const reloadTimerRef = useRef<number | null>(null);
  const pendingRenameTimerRef = useRef<number | null>(null);
  const pendingRenamesRef = useRef<PendingRenameEntry[]>([]);
  const lastToastKeyRef = useRef<string | null>(null);
  const reconcileInFlightRef = useRef(false);

  useEffect(() => {
    if (!vaultPath || !notesPath || isPaused) {
      return;
    }

    let disposed = false;
    let unwatch: (() => Promise<void>) | null = null;
    let releaseWatcher: (() => void) | null = null;
    let reconcilePollTimer: number | null = null;

    const syncActions = createNotesExternalSyncActions({
      notesPath,
      loadFileTree,
      invalidateNoteCache,
      syncCurrentNoteFromDisk,
      applyExternalPathRename,
      applyExternalPathDeletion,
      reloadTimerRef,
      pendingRenameTimerRef,
      pendingRenamesRef,
      lastToastKeyRef,
      reconcileInFlightRef,
    });

    const stopReconcilePolling = () => {
      if (reconcilePollTimer !== null) {
        window.clearInterval(reconcilePollTimer);
        reconcilePollTimer = null;
      }
    };

    const startReconcilePolling = () => {
      if (shouldAvoidRecursiveNativeWatch(notesPath)) {
        void runPollingReconcile();
        return;
      }

      if (reconcilePollTimer !== null) {
        return;
      }

      reconcilePollTimer = window.setInterval(() => {
        if (document.visibilityState !== 'visible') {
          return;
        }
        void syncActions.runPollingReconcile();
      }, NOTES_RECONCILE_POLL_MS);
      void syncActions.runPollingReconcile();
    };

    const reconcileOnFocus = () => {
      void syncActions.runPollingReconcile();
    };

    const reconcileOnVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void syncActions.runPollingReconcile();
      }
    };

    const run = async () => {
      if (shouldAvoidRecursiveNativeWatch(notesPath)) {
        return;
      }

      try {
        const stopWatching = await watchDesktopPath(notesPath, async (event) => {
          if (disposed) {
            return;
          }

          await syncActions.handleWatchEvent(vaultPath, event);
        });
        if (disposed) {
          void stopWatching();
          return;
        }

        unwatch = stopWatching;
        releaseWatcher = registerExternalSyncWatcher();
      } catch (error) {
        if (disposed) {
          return;
        }

        if (isExternalWatchUnavailableError(error)) {
          startReconcilePolling();
          return;
        }

        console.error(
          '[NotesExternalSync] Failed to start filesystem watch:',
          getExternalWatchErrorMessage(error)
        );
      }
    };

    void run();
    window.addEventListener('focus', reconcileOnFocus);
    document.addEventListener('visibilitychange', reconcileOnVisibilityChange);

    return () => {
      disposed = true;
      window.removeEventListener('focus', reconcileOnFocus);
      document.removeEventListener('visibilitychange', reconcileOnVisibilityChange);
      stopReconcilePolling();
      syncActions.clearTimers();
      void unwatch?.();
      releaseWatcher?.();
    };
  }, [
    applyExternalPathDeletion,
    applyExternalPathRename,
    invalidateNoteCache,
    isPaused,
    loadFileTree,
    notesPath,
    syncCurrentNoteFromDisk,
    vaultPath,
  ]);
}
