import { useEffect, useRef, useSyncExternalStore } from 'react';
import { watchDesktopPath } from '@/lib/desktop/watch';
import { shouldIgnoreExpectedExternalChange } from '@/stores/notes/document/externalChangeRegistry';
import { ensureVaultConfig } from '@/stores/vaultConfig';
import {
  isExternalSyncPaused,
  registerExternalSyncWatcher,
  subscribeExternalSyncPause,
} from '@/stores/notes/document/externalSyncControl';
import { useVaultStore } from '@/stores/useVaultStore';
import {
  flushExpiredPendingRenames,
  getNextPendingRenameDelay,
  matchPendingRename,
  queuePendingRename,
  type PendingRenameEntry,
} from './notesExternalRenameQueue';
import {
  findRenamedVaultPathBySignature,
  getVaultExternalWatchPaths,
  isDirectChildPath,
  looksLikeVaultRoot,
  readVaultConfigSignature,
} from './currentVaultExternalPathSyncUtils';
import {
  getExternalWatchErrorMessage,
  isExternalWatchUnavailableError,
} from './externalWatchErrorUtils';
import {
  getAbsoluteRenameWatchPaths,
  isCreateWatchEvent,
  isRemoveWatchEvent,
  normalizeFsPath,
} from './notesExternalSyncUtils';

const ROOT_PENDING_RENAME_TTL_MS = 500;
const ROOT_RECONCILE_POLL_MS = 1500;
export function useCurrentVaultExternalPathSync(vaultPath: string | null) {
  const isPaused = useSyncExternalStore(
    subscribeExternalSyncPause,
    isExternalSyncPaused,
    () => false
  );
  const syncCurrentVaultExternalPath = useVaultStore((state) => state.syncCurrentVaultExternalPath);
  const pendingRenameTimerRef = useRef<number | null>(null);
  const pendingRenamesRef = useRef<PendingRenameEntry[]>([]);
  const reconcileInFlightRef = useRef(false);

  useEffect(() => {
    if (!vaultPath || isPaused) {
      return;
    }

    const watchPaths = getVaultExternalWatchPaths(vaultPath);
    if (!watchPaths) {
      return;
    }
    const { normalizedVaultPath, normalizedParentPath, watchParentPath } = watchPaths;

    let disposed = false;
    let unwatch: (() => Promise<void>) | null = null;
    let releaseWatcher: (() => void) | null = null;
    let reconcilePollTimer: number | null = null;
    let vaultSignature: string | null = null;

    const schedulePendingRenameFlush = () => {
      if (pendingRenameTimerRef.current !== null) {
        window.clearTimeout(pendingRenameTimerRef.current);
        pendingRenameTimerRef.current = null;
      }

      const delay = getNextPendingRenameDelay(pendingRenamesRef.current, Date.now());
      if (delay == null) {
        return;
      }

      pendingRenameTimerRef.current = window.setTimeout(() => {
        pendingRenameTimerRef.current = null;
        pendingRenamesRef.current = flushExpiredPendingRenames(
          pendingRenamesRef.current,
          Date.now()
        ).queue;
        schedulePendingRenameFlush();
      }, delay);
    };

    const queueVaultRename = (oldPath: string) => {
      if (oldPath !== normalizedVaultPath) {
        return;
      }

      pendingRenamesRef.current = queuePendingRename(
        pendingRenamesRef.current,
        oldPath,
        Date.now(),
        ROOT_PENDING_RENAME_TTL_MS
      );
      schedulePendingRenameFlush();
    };

    const applyMatchedVaultRename = async (newPath: string) => {
      if (!isDirectChildPath(normalizedParentPath, newPath)) {
        return false;
      }

      if (!(await looksLikeVaultRoot(newPath))) {
        return false;
      }

      syncCurrentVaultExternalPath(normalizeFsPath(newPath));
      return true;
    };

    const reconcileMissingVaultPath = async () => {
      const matchedPath = await findRenamedVaultPathBySignature(
        watchParentPath,
        vaultPath,
        vaultSignature
      );
      if (!matchedPath) {
        return false;
      }

      syncCurrentVaultExternalPath(normalizeFsPath(matchedPath));
      return true;
    };

    const runReconcile = async () => {
      if (reconcileInFlightRef.current) {
        return false;
      }

      reconcileInFlightRef.current = true;
      try {
        return await reconcileMissingVaultPath();
      } finally {
        reconcileInFlightRef.current = false;
      }
    };

    const stopReconcilePolling = () => {
      if (reconcilePollTimer !== null) {
        window.clearInterval(reconcilePollTimer);
        reconcilePollTimer = null;
      }
    };

    const startReconcilePolling = () => {
      if (reconcilePollTimer !== null) {
        return;
      }

      reconcilePollTimer = window.setInterval(() => {
        if (document.visibilityState !== 'visible') {
          return;
        }
        void runReconcile();
      }, ROOT_RECONCILE_POLL_MS);
    };

    const reconcileOnFocus = () => {
      void runReconcile();
    };

    const reconcileOnVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void runReconcile();
      }
    };

    const run = async () => {
      try {
        await ensureVaultConfig(vaultPath);
        vaultSignature = await readVaultConfigSignature(vaultPath);
        const stopWatching = await watchDesktopPath(watchParentPath, async (event) => {
          if (disposed) {
            return;
          }

          pendingRenamesRef.current = flushExpiredPendingRenames(
            pendingRenamesRef.current,
            Date.now()
          ).queue;
          schedulePendingRenameFlush();

          const unexpectedPaths = event.paths
            .map((path) => normalizeFsPath(path))
            .filter((path) => path && !shouldIgnoreExpectedExternalChange(path));

          if (unexpectedPaths.length === 0) {
            return;
          }


          const renamePaths = getAbsoluteRenameWatchPaths({
            ...event,
            paths: unexpectedPaths,
          });

          if (renamePaths) {
            const oldPath = renamePaths.oldPath ? normalizeFsPath(renamePaths.oldPath) : null;
            const newPath = renamePaths.newPath ? normalizeFsPath(renamePaths.newPath) : null;

            if (oldPath === normalizedVaultPath && newPath) {
              if (await applyMatchedVaultRename(newPath)) {
                return;
              }
              await reconcileMissingVaultPath();
              return;
            }

            if (oldPath === normalizedVaultPath) {
              queueVaultRename(oldPath);
              return;
            }

            if (newPath) {
              const { queue, oldPath: matchedOldPath } = matchPendingRename(
                pendingRenamesRef.current,
                Date.now()
              );
              pendingRenamesRef.current = queue;
              schedulePendingRenameFlush();

              if (matchedOldPath === normalizedVaultPath) {
                if (await applyMatchedVaultRename(newPath)) {
                  return;
                }
                await reconcileMissingVaultPath();
              }
            }

            return;
          }

          if (isRemoveWatchEvent(event) && unexpectedPaths.includes(normalizedVaultPath)) {
            queueVaultRename(normalizedVaultPath);
            return;
          }

          if (!isCreateWatchEvent(event)) {
            return;
          }

          const { queue, oldPath: matchedOldPath } = matchPendingRename(
            pendingRenamesRef.current,
            Date.now()
          );
          pendingRenamesRef.current = queue;
          schedulePendingRenameFlush();

          if (matchedOldPath !== normalizedVaultPath) {
            return;
          }

          for (const candidatePath of unexpectedPaths) {
            if (await applyMatchedVaultRename(candidatePath)) {
              return;
            }
          }

          await reconcileMissingVaultPath();
        });
        if (disposed) {
          void stopWatching();
          return;
        }

        unwatch = stopWatching;
        releaseWatcher = registerExternalSyncWatcher();
      } catch (error) {
        if (!disposed) {
          if (isExternalWatchUnavailableError(error)) {
            startReconcilePolling();
            return;
          }
          console.error('[CurrentVaultExternalSync] Failed to start filesystem watch:', getExternalWatchErrorMessage(error));
        }
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
      if (pendingRenameTimerRef.current !== null) {
        window.clearTimeout(pendingRenameTimerRef.current);
        pendingRenameTimerRef.current = null;
      }
      pendingRenamesRef.current = [];
      void unwatch?.();
      releaseWatcher?.();
    };
  }, [isPaused, syncCurrentVaultExternalPath, vaultPath]);
}
