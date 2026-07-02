import { useEffect, useRef, useSyncExternalStore } from 'react';
import { watchDesktopPath } from '@/lib/desktop/watch';
import { shouldIgnoreExpectedExternalChange } from '@/stores/notes/document/externalChangeRegistry';
import { ensureNotesRootConfig } from '@/stores/notesRootConfig';
import {
  isExternalSyncPaused,
  registerExternalSyncWatcher,
  subscribeExternalSyncPause,
} from '@/stores/notes/document/externalSyncControl';
import { useNotesRootStore } from '@/stores/useNotesRootStore';
import {
  flushExpiredPendingRenames,
  getNextPendingRenameDelay,
  matchPendingRename,
  queuePendingRename,
  type PendingRenameEntry,
} from './notesExternalRenameQueue';
import {
  getNotesRootExternalWatchPaths,
  isDirectChildPath,
  looksLikeNotesRootRoot,
} from './currentNotesRootExternalPathSyncUtils';
import {
  isExternalWatchUnavailableError,
} from './externalWatchErrorUtils';
import {
  getAbsoluteRenameWatchPaths,
  getFsPathComparisonKey,
  isCreateWatchEvent,
  isRemoveWatchEvent,
  normalizeFsPath,
} from './notesExternalSyncUtils';

const ROOT_PENDING_RENAME_TTL_MS = 500;

function isSameFsPath(path: string | null | undefined, otherPath: string | null | undefined) {
  if (!path || !otherPath) {
    return false;
  }
  return getFsPathComparisonKey(path) === getFsPathComparisonKey(otherPath);
}

export function useCurrentNotesRootExternalPathSync(notesRootPath: string | null) {
  const isPaused = useSyncExternalStore(
    subscribeExternalSyncPause,
    isExternalSyncPaused,
    () => false
  );
  const syncCurrentNotesRootExternalPath = useNotesRootStore((state) => state.syncCurrentNotesRootExternalPath);
  const pendingRenameTimerRef = useRef<number | null>(null);
  const pendingRenamesRef = useRef<PendingRenameEntry[]>([]);

  useEffect(() => {
    if (!notesRootPath || isPaused) {
      return;
    }

    const watchPaths = getNotesRootExternalWatchPaths(notesRootPath);
    if (!watchPaths) {
      return;
    }
    const { normalizedNotesRootPath, normalizedParentPath, watchParentPath } = watchPaths;

    let disposed = false;
    let unwatch: (() => Promise<void>) | null = null;
    let releaseWatcher: (() => void) | null = null;

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

    const queueNotesRootRename = (oldPath: string) => {
      if (!isSameFsPath(oldPath, normalizedNotesRootPath)) {
        return;
      }
      pendingRenamesRef.current = queuePendingRename(
        pendingRenamesRef.current,
        normalizedNotesRootPath,
        Date.now(),
        ROOT_PENDING_RENAME_TTL_MS
      );
      schedulePendingRenameFlush();
    };

    const applyMatchedNotesRootRename = async (newPath: string) => {
      if (!isDirectChildPath(normalizedParentPath, newPath)) {
        return false;
      }

      let isNotesRootRoot = false;
      try {
        isNotesRootRoot = await looksLikeNotesRootRoot(newPath);
      } catch {
        return false;
      }

      if (!isNotesRootRoot) {
        return false;
      }
      if (disposed) {
        return false;
      }

      syncCurrentNotesRootExternalPath(normalizeFsPath(newPath));
      return true;
    };

    const run = async () => {
      try {
        await ensureNotesRootConfig(notesRootPath);
        const stopWatching = await watchDesktopPath(
          watchParentPath,
          async (event) => {
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

              if (isSameFsPath(oldPath, normalizedNotesRootPath) && newPath) {
                if (await applyMatchedNotesRootRename(newPath)) {
                  return;
                }
                return;
              }

              if (oldPath && isSameFsPath(oldPath, normalizedNotesRootPath)) {
                queueNotesRootRename(oldPath);
                return;
              }
              if (newPath) {
                const { queue, oldPath: matchedOldPath } = matchPendingRename(
                  pendingRenamesRef.current,
                  Date.now()
                );
                pendingRenamesRef.current = queue;
                schedulePendingRenameFlush();

                if (isSameFsPath(matchedOldPath, normalizedNotesRootPath)) {
                  if (await applyMatchedNotesRootRename(newPath)) {
                    return;
                  }
                }
              }

              return;
            }

            if (isRemoveWatchEvent(event) && unexpectedPaths.some((path) => isSameFsPath(path, normalizedNotesRootPath))) {
              queueNotesRootRename(normalizedNotesRootPath);
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

            if (!isSameFsPath(matchedOldPath, normalizedNotesRootPath)) {
              return;
            }
            for (const candidatePath of unexpectedPaths) {
              if (await applyMatchedNotesRootRename(candidatePath)) {
                return;
              }
            }
          },
          { recursive: false }
        );
        if (disposed) {
          void stopWatching().catch(() => undefined);
          return;
        }

        unwatch = stopWatching;
        releaseWatcher = registerExternalSyncWatcher();
      } catch (error) {
        if (!disposed) {
          if (isExternalWatchUnavailableError(error)) {
            return;
          }
        }
      }
    };

    void run().catch(() => undefined);

    return () => {
      disposed = true;
      if (pendingRenameTimerRef.current !== null) {
        window.clearTimeout(pendingRenameTimerRef.current);
        pendingRenameTimerRef.current = null;
      }
      pendingRenamesRef.current = [];
      void unwatch?.().catch(() => undefined);
      releaseWatcher?.();
    };
  }, [isPaused, syncCurrentNotesRootExternalPath, notesRootPath]);
}
