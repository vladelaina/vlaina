import { useEffect, useRef } from 'react';
import { watchDesktopPath } from '@/lib/desktop/watch';
import { normalizeContainedAssetPath } from '@/lib/assets/core/pathContainment';
import { getParentPath, isAbsolutePath } from '@/lib/storage/adapter';
import {
  getNotesExternalPathEventsRelativePath,
  readNotesExternalPathEvents,
  subscribeNotesExternalPathRename,
} from '@/stores/notes/document/externalPathBroadcast';
import { useNotesStore } from '@/stores/notes/useNotesStore';
import { hasInternalNotePathSegment } from '@/stores/notes/utils/fs/internalNotePaths';
import {
  getAbsoluteRenameWatchPaths,
  getFsPathComparisonKey,
  hasUnsafeFsPathSegment,
  isMarkdownPath,
  isRemoveWatchEvent,
  normalizeFsPath,
  toVaultRelativePath,
} from './notesExternalSyncUtils';
import { rememberProcessedRenameEventNonce } from './notesExternalRenameQueue';

const BROAD_ABSOLUTE_NOTE_SYNC_POLL_MS = 5000;

function isAbsoluteRenamePathInsideParent(parentPath: string, path: string) {
  return isAbsolutePath(path) && normalizeContainedAssetPath(path, parentPath) !== null;
}

function isSameFsPath(path: string, otherPath: string) {
  return getFsPathComparisonKey(path) === getFsPathComparisonKey(otherPath);
}

function isAbsoluteRenamePathRelevant(watchedNotePath: string, oldPath: string, newPath: string) {
  if (!isAbsolutePath(oldPath) || !isAbsolutePath(newPath)) {
    return false;
  }

  return isSameFsPath(oldPath, watchedNotePath) || isPathWithin(watchedNotePath, oldPath);
}

function shouldAvoidNativeAbsoluteNoteWatch(parentPath: string) {
  const normalized = parentPath.replace(/\\/g, '/').replace(/\/+$/, '');
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

function isPathWithin(path: string, basePath: string) {
  const pathKey = getFsPathComparisonKey(path);
  const basePathKey = getFsPathComparisonKey(basePath);
  return pathKey === basePathKey || pathKey.startsWith(`${basePathKey}/`);
}

export function useAbsoluteNoteExternalRenameSync(currentNotePath: string | undefined) {
  const applyExternalPathRename = useNotesStore((state) => state.applyExternalPathRename);
  const syncCurrentNoteFromDisk = useNotesStore((state) => state.syncCurrentNoteFromDisk);
  const processedRenameEventNoncesRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!currentNotePath || !isAbsolutePath(currentNotePath)) {
      return;
    }

    if (hasInternalNotePathSegment(currentNotePath)) {
      return;
    }

    const parentPath = getParentPath(currentNotePath);
    if (!parentPath) {
      return;
    }
    const watchedParentPath = parentPath;
    const watchedNotePath = normalizeFsPath(currentNotePath);

    let disposed = false;
    let unwatch: (() => Promise<void>) | null = null;
    let pollingTimer: number | null = null;
    const eventFileStartedAt = Date.now();

    async function applyRenameEvent(event: { nonce?: string; oldPath: string; newPath: string }) {
      if (disposed) {
        return;
      }

      if (event.nonce) {
        if (!rememberProcessedRenameEventNonce(processedRenameEventNoncesRef.current, event.nonce)) {
          return;
        }
      }

      const oldPath = normalizeFsPath(event.oldPath);
      const newPath = normalizeFsPath(event.newPath);
      if (
        hasUnsafeFsPathSegment(oldPath) ||
        hasUnsafeFsPathSegment(newPath) ||
        hasInternalNotePathSegment(oldPath) ||
        hasInternalNotePathSegment(newPath)
      ) {
        return;
      }

      if (
        !isAbsoluteRenamePathInsideParent(watchedParentPath, oldPath) &&
        !isAbsoluteRenamePathRelevant(watchedNotePath, oldPath, newPath)
      ) {
        return;
      }

      const isCurrentFileRename = isSameFsPath(oldPath, watchedNotePath);
      const isCurrentFolderRename = !isCurrentFileRename && isPathWithin(watchedNotePath, oldPath);

      if (isCurrentFileRename && !isMarkdownPath(newPath)) {
        await syncCurrentNoteFromDisk({ force: true });
        return;
      }

      if (!isCurrentFolderRename && (!isMarkdownPath(oldPath) || !isMarkdownPath(newPath))) {
        return;
      }

      await applyExternalPathRename(oldPath, newPath);
    }

    const unsubscribeRenameBroadcast = subscribeNotesExternalPathRename(
      watchedParentPath,
      (event) => {
        void applyRenameEvent(event);
      }
    );

    const reconcileExternalPathEventFile = async () => {
      const events = await readNotesExternalPathEvents(watchedParentPath, {
        afterStamp: eventFileStartedAt,
      });
      if (disposed) {
        return;
      }

      for (const event of events) {
        await applyRenameEvent(event);
      }
    };

    const isExternalPathEventFileWatchPath = (path: string) => {
      const eventRelativePath = getNotesExternalPathEventsRelativePath();
      return toVaultRelativePath(watchedParentPath, path) === eventRelativePath;
    };

    const isCurrentNoteWatchEvent = (paths: string[]) => (
      paths.some((path) => isSameFsPath(normalizeFsPath(path), watchedNotePath))
    );

    const syncCurrentAbsoluteNote = () => {
      if (disposed || document.visibilityState !== 'visible') {
        return;
      }

      void syncCurrentNoteFromDisk({ force: true });
    };

    const startPollingSync = () => {
      if (pollingTimer !== null) {
        return;
      }

      pollingTimer = window.setInterval(syncCurrentAbsoluteNote, BROAD_ABSOLUTE_NOTE_SYNC_POLL_MS);
      window.addEventListener('focus', syncCurrentAbsoluteNote);
      document.addEventListener('visibilitychange', syncCurrentAbsoluteNote);
    };

    const run = async () => {
      if (shouldAvoidNativeAbsoluteNoteWatch(watchedParentPath)) {
        startPollingSync();
        return;
      }

      try {
        const stopWatching = await watchDesktopPath(
          watchedParentPath,
          async (event) => {
            if (disposed) {
              return;
            }

            const remainingPaths = event.paths.filter((path) => !isExternalPathEventFileWatchPath(path));
            if (remainingPaths.length !== event.paths.length) {
              await reconcileExternalPathEventFile();
              if (remainingPaths.length === 0) {
                return;
              }
            }

            const renamePaths = getAbsoluteRenameWatchPaths({
              ...event,
              paths: remainingPaths.map((path) => normalizeFsPath(path)),
            });
            if (renamePaths) {
              if (renamePaths.oldPath && renamePaths.newPath) {
                await applyRenameEvent({
                  oldPath: renamePaths.oldPath,
                  newPath: renamePaths.newPath,
                });
              }
              return;
            }

            if (isCurrentNoteWatchEvent(remainingPaths)) {
              await syncCurrentNoteFromDisk({ force: true });
              if (isRemoveWatchEvent(event)) {
                return;
              }
            }
          },
          { recursive: true }
        );

        if (disposed) {
          void stopWatching();
          return;
        }

        unwatch = stopWatching;
      } catch {
        if (!disposed) {
          startPollingSync();
        }
      }
    };

    void run();

    return () => {
      disposed = true;
      if (pollingTimer !== null) {
        window.clearInterval(pollingTimer);
        pollingTimer = null;
      }
      window.removeEventListener('focus', syncCurrentAbsoluteNote);
      document.removeEventListener('visibilitychange', syncCurrentAbsoluteNote);
      unsubscribeRenameBroadcast();
      void unwatch?.();
    };
  }, [applyExternalPathRename, currentNotePath, syncCurrentNoteFromDisk]);
}
