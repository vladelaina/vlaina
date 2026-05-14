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
import {
  getAbsoluteRenameWatchPaths,
  isRemoveWatchEvent,
  normalizeFsPath,
  toVaultRelativePath,
} from './notesExternalSyncUtils';
import { rememberProcessedRenameEventNonce } from './notesExternalRenameQueue';

function isAbsoluteRenamePathInsideParent(parentPath: string, path: string) {
  return isAbsolutePath(path) && normalizeContainedAssetPath(path, parentPath) !== null;
}

export function useAbsoluteNoteExternalRenameSync(currentNotePath: string | undefined) {
  const applyExternalPathRename = useNotesStore((state) => state.applyExternalPathRename);
  const syncCurrentNoteFromDisk = useNotesStore((state) => state.syncCurrentNoteFromDisk);
  const processedRenameEventNoncesRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!currentNotePath || !isAbsolutePath(currentNotePath)) {
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

      if (
        !isAbsoluteRenamePathInsideParent(watchedParentPath, event.oldPath) ||
        !isAbsoluteRenamePathInsideParent(watchedParentPath, event.newPath)
      ) {
        return;
      }

      await applyExternalPathRename(event.oldPath, event.newPath);
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

    const isExternalPathEventFileWatchEvent = (paths: string[]) => {
      const eventRelativePath = getNotesExternalPathEventsRelativePath();
      return paths.some((path) => toVaultRelativePath(watchedParentPath, path) === eventRelativePath);
    };

    const isCurrentNoteWatchEvent = (paths: string[]) => (
      paths.some((path) => normalizeFsPath(path) === watchedNotePath)
    );

    const run = async () => {
      try {
        const stopWatching = await watchDesktopPath(
          watchedParentPath,
          async (event) => {
            if (disposed) {
              return;
            }

            if (isExternalPathEventFileWatchEvent(event.paths)) {
              await reconcileExternalPathEventFile();
              return;
            }

            const renamePaths = getAbsoluteRenameWatchPaths({
              ...event,
              paths: event.paths.map((path) => normalizeFsPath(path)),
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

            if (isCurrentNoteWatchEvent(event.paths)) {
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
      } catch (error) {
        console.error('[AbsoluteNoteExternalRenameSync] Failed to start filesystem watch:', error);
      }
    };

    void run();

    return () => {
      disposed = true;
      unsubscribeRenameBroadcast();
      void unwatch?.();
    };
  }, [applyExternalPathRename, currentNotePath, syncCurrentNoteFromDisk]);
}
