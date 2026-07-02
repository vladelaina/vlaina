import { useEffect, useMemo } from 'react';
import { watchDesktopPath } from '@/lib/desktop/watch';
import { getParentPath, isAbsolutePath } from '@/lib/storage/adapter';
import { useNotesStore } from '@/stores/useNotesStore';
import { useNotesRootStore } from '@/stores/useNotesRootStore';
import type { StarredEntry } from '@/stores/notes/types';
import { hasInternalNotePathSegment } from '@/stores/notes/utils/fs/internalNotePaths';
import {
  getStarredEntryAbsolutePath,
  isSameStarredNotesRootPath,
  normalizeStarredNotesRootPath,
} from '@/stores/notes/starred';
import {
  getAbsoluteRenameWatchPaths,
  getFsPathComparisonKey,
  hasUnsafeFsPathSegment,
  isCreateWatchEvent,
  isMarkdownPath,
  isRemoveWatchEvent,
  normalizeFsPath,
} from '../../hooks/notesExternalSyncUtils';

const PENDING_STARRED_RENAME_TTL_MS = 180;

function isSameFsPath(path: string, otherPath: string) {
  return getFsPathComparisonKey(path) === getFsPathComparisonKey(otherPath);
}

function getExternalStarredWatchEntries(
  entries: StarredEntry[],
  currentNotesRootPath: string,
) {
  const watchedEntries: Array<{ absolutePath: string; watchPath: string }> = [];

  for (const entry of entries) {
    if (entry.kind !== 'note') {
      continue;
    }

    if (isSameStarredNotesRootPath(entry.notesRootPath, currentNotesRootPath)) {
      continue;
    }

    const absolutePath = getStarredEntryAbsolutePath(entry);
    if (!absolutePath || !isAbsolutePath(absolutePath)) {
      continue;
    }
    if (hasInternalNotePathSegment(absolutePath)) {
      continue;
    }

    const watchPath = getParentPath(absolutePath);
    if (!watchPath) {
      continue;
    }

    watchedEntries.push({
      absolutePath: normalizeFsPath(absolutePath),
      watchPath: normalizeFsPath(watchPath),
    });
  }

  return watchedEntries;
}

export function useExternalStarredRenameSync() {
  const starredEntries = useNotesStore((state) => state.starredEntries);
  const applyExternalPathRename = useNotesStore((state) => state.applyExternalPathRename);
  const currentNotesRoot = useNotesRootStore((state) => state.currentNotesRoot);
  const currentNotesRootPath = currentNotesRoot?.path ? normalizeStarredNotesRootPath(currentNotesRoot.path) : '';
  const watchEntries = useMemo(
    () => getExternalStarredWatchEntries(starredEntries, currentNotesRootPath),
    [currentNotesRootPath, starredEntries],
  );

  useEffect(() => {
    if (watchEntries.length === 0) {
      return;
    }

    let disposed = false;
    const unwatchers: Array<() => Promise<void>> = [];
    const clearPendingRenameTimers: Array<() => void> = [];
    const watchedPaths = new Set<string>();

    for (const entry of watchEntries) {
      if (watchedPaths.has(entry.absolutePath)) {
        continue;
      }
      watchedPaths.add(entry.absolutePath);
      let pendingOldPath: string | null = null;
      let pendingRenameTimer: number | null = null;
      const clearPendingRename = () => {
        pendingOldPath = null;
        if (pendingRenameTimer !== null) {
          window.clearTimeout(pendingRenameTimer);
          pendingRenameTimer = null;
        }
      };
      const queuePendingRename = (oldPath: string) => {
        pendingOldPath = oldPath;
        if (pendingRenameTimer !== null) {
          window.clearTimeout(pendingRenameTimer);
        }
        pendingRenameTimer = window.setTimeout(() => {
          pendingOldPath = null;
          pendingRenameTimer = null;
        }, PENDING_STARRED_RENAME_TTL_MS);
      };
      const applyRename = async (oldPath: string, newPath: string) => {
        if (!isSameFsPath(entry.absolutePath, oldPath)) {
          return false;
        }

        if (
          hasUnsafeFsPathSegment(oldPath) ||
          hasUnsafeFsPathSegment(newPath) ||
          hasInternalNotePathSegment(oldPath) ||
          hasInternalNotePathSegment(newPath)
        ) {
          return false;
        }

        if (!isMarkdownPath(oldPath) || !isMarkdownPath(newPath)) {
          return false;
        }

        try {
          await applyExternalPathRename(oldPath, newPath);
        } catch {
          return false;
        }
        clearPendingRename();
        return true;
      };
      clearPendingRenameTimers.push(clearPendingRename);

      try {
        void watchDesktopPath(
          entry.watchPath,
          async (event) => {
            if (disposed) {
              return;
            }

            const normalizedPaths = event.paths.map((path) => normalizeFsPath(path));
            const renamePaths = getAbsoluteRenameWatchPaths({
              ...event,
              paths: normalizedPaths,
            });
            if (renamePaths?.oldPath && renamePaths.newPath) {
              await applyRename(
                normalizeFsPath(renamePaths.oldPath),
                normalizeFsPath(renamePaths.newPath),
              );
              return;
            }

            if (renamePaths?.oldPath) {
              const oldPath = normalizeFsPath(renamePaths.oldPath);
              if (isSameFsPath(entry.absolutePath, oldPath)) {
                queuePendingRename(oldPath);
              }
              return;
            }

            if (renamePaths?.newPath) {
              if (pendingOldPath) {
                await applyRename(pendingOldPath, normalizeFsPath(renamePaths.newPath));
              }
              return;
            }

            if (isRemoveWatchEvent(event)) {
              const removedPath = normalizedPaths.find((path) => isSameFsPath(entry.absolutePath, path));
              if (removedPath) {
                queuePendingRename(removedPath);
              }
              return;
            }

            if (!isCreateWatchEvent(event) || !pendingOldPath) {
              return;
            }

            for (const newPath of normalizedPaths) {
              if (await applyRename(pendingOldPath, newPath)) {
                return;
              }
            }
          },
          { recursive: false },
        ).then(
          (unwatch) => {
            if (disposed) {
              void unwatch().catch(() => undefined);
              return;
            }
            unwatchers.push(unwatch);
          },
          (_error) => {
            if (!disposed) {
            }
          },
        );
      } catch {
      }
    }

    return () => {
      disposed = true;
      for (const clearPendingRenameTimer of clearPendingRenameTimers) {
        clearPendingRenameTimer();
      }
      for (const unwatch of unwatchers) {
        void unwatch().catch(() => undefined);
      }
    };
  }, [applyExternalPathRename, watchEntries]);
}
