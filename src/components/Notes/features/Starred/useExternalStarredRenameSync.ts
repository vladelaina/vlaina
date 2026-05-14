import { useEffect, useMemo } from 'react';
import { watchDesktopPath } from '@/lib/desktop/watch';
import { getParentPath, isAbsolutePath } from '@/lib/storage/adapter';
import { useNotesStore } from '@/stores/useNotesStore';
import { useVaultStore } from '@/stores/useVaultStore';
import type { StarredEntry } from '@/stores/notes/types';
import {
  getStarredEntryAbsolutePath,
  normalizeStarredVaultPath,
} from '@/stores/notes/starred';
import { getAbsoluteRenameWatchPaths, normalizeFsPath } from '../../hooks/notesExternalSyncUtils';

function isPathWithin(path: string, basePath: string) {
  return path === basePath || path.startsWith(`${basePath}/`);
}

function getExternalStarredWatchEntries(
  entries: StarredEntry[],
  currentVaultPath: string,
) {
  const watchedEntries: Array<{ absolutePath: string; parentPath: string }> = [];

  for (const entry of entries) {
    if (entry.kind !== 'note') {
      continue;
    }

    if (normalizeStarredVaultPath(entry.vaultPath) === currentVaultPath) {
      continue;
    }

    const absolutePath = getStarredEntryAbsolutePath(entry);
    if (!absolutePath || !isAbsolutePath(absolutePath)) {
      continue;
    }

    const parentPath = getParentPath(absolutePath);
    if (!parentPath) {
      continue;
    }

    watchedEntries.push({
      absolutePath: normalizeFsPath(absolutePath),
      parentPath: normalizeFsPath(parentPath),
    });
  }

  return watchedEntries;
}

export function useExternalStarredRenameSync() {
  const starredEntries = useNotesStore((state) => state.starredEntries);
  const applyExternalPathRename = useNotesStore((state) => state.applyExternalPathRename);
  const currentVault = useVaultStore((state) => state.currentVault);
  const currentVaultPath = currentVault?.path ? normalizeStarredVaultPath(currentVault.path) : '';
  const watchEntries = useMemo(
    () => getExternalStarredWatchEntries(starredEntries, currentVaultPath),
    [currentVaultPath, starredEntries],
  );

  useEffect(() => {
    if (watchEntries.length === 0) {
      return;
    }

    let disposed = false;
    const unwatchers: Array<() => Promise<void>> = [];
    const watchedPathsByParent = new Map<string, Set<string>>();

    for (const entry of watchEntries) {
      const paths = watchedPathsByParent.get(entry.parentPath) ?? new Set<string>();
      paths.add(entry.absolutePath);
      watchedPathsByParent.set(entry.parentPath, paths);
    }

    for (const [parentPath, watchedPaths] of watchedPathsByParent) {
      void watchDesktopPath(
        parentPath,
        async (event) => {
          if (disposed) {
            return;
          }

          const renamePaths = getAbsoluteRenameWatchPaths({
            ...event,
            paths: event.paths.map((path) => normalizeFsPath(path)),
          });
          if (!renamePaths?.oldPath || !renamePaths.newPath) {
            return;
          }

          const oldPath = normalizeFsPath(renamePaths.oldPath);
          const isWatchedRename = Array.from(watchedPaths).some((watchedPath) =>
            isPathWithin(watchedPath, oldPath)
          );
          if (!isWatchedRename) {
            return;
          }

          await applyExternalPathRename(oldPath, normalizeFsPath(renamePaths.newPath));
        },
        { recursive: false },
      ).then(
        (unwatch) => {
          if (disposed) {
            void unwatch();
            return;
          }
          unwatchers.push(unwatch);
        },
        (error) => {
          if (!disposed) {
            console.error('[ExternalStarredRenameSync] Failed to start filesystem watch:', error);
          }
        },
      );
    }

    return () => {
      disposed = true;
      for (const unwatch of unwatchers) {
        void unwatch();
      }
    };
  }, [applyExternalPathRename, watchEntries]);
}
