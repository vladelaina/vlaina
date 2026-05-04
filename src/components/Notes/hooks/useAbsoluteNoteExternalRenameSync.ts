import { useEffect, useRef } from 'react';
import { watchDesktopPath } from '@/lib/desktop/watch';
import { getParentPath, isAbsolutePath } from '@/lib/storage/adapter';
import {
  getNotesExternalPathEventsRelativePath,
  readNotesExternalPathEvents,
  subscribeNotesExternalPathRename,
} from '@/stores/notes/document/externalPathBroadcast';
import { useNotesStore } from '@/stores/notes/useNotesStore';
import {
  getAbsoluteRenameWatchPaths,
  normalizeFsPath,
  toVaultRelativePath,
} from './notesExternalSyncUtils';
import { rememberProcessedRenameEventNonce } from './notesExternalRenameQueue';

export function useAbsoluteNoteExternalRenameSync(currentNotePath: string | undefined) {
  const applyExternalPathRename = useNotesStore((state) => state.applyExternalPathRename);
  const processedRenameEventNoncesRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!currentNotePath || !isAbsolutePath(currentNotePath)) {
      return;
    }

    const parentPath = getParentPath(currentNotePath);
    if (!parentPath) {
      return;
    }

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

      await applyExternalPathRename(event.oldPath, event.newPath);
    }

    const unsubscribeRenameBroadcast = subscribeNotesExternalPathRename(
      parentPath,
      (event) => {
        void applyRenameEvent(event);
      }
    );

    const reconcileExternalPathEventFile = async () => {
      const events = await readNotesExternalPathEvents(parentPath, {
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
      return paths.some((path) => toVaultRelativePath(parentPath, path) === eventRelativePath);
    };

    const run = async () => {
      try {
        const stopWatching = await watchDesktopPath(
          parentPath,
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
            if (!renamePaths?.oldPath || !renamePaths.newPath) {
              return;
            }

            await applyRenameEvent({
              oldPath: renamePaths.oldPath,
              newPath: renamePaths.newPath,
            });
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
  }, [applyExternalPathRename, currentNotePath]);
}
