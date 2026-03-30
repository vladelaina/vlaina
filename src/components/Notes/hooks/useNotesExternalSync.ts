import { useEffect, useRef } from 'react';
import { watchImmediate } from '@tauri-apps/plugin-fs';
import { isAbsolutePath, isTauri } from '@/lib/storage/adapter';
import { useNotesStore } from '@/stores/notes/useNotesStore';
import { useToastStore } from '@/stores/useToastStore';
import { shouldIgnoreExpectedExternalChange } from '@/stores/notes/document/externalChangeRegistry';
import {
  flushExpiredPendingRenames,
  getNextPendingRenameDelay,
  matchPendingRename,
  queuePendingRename,
  type PendingRenameEntry,
} from './notesExternalRenameQueue';
import {
  getRelativeRenameWatchPaths,
  getRelevantRelativeWatchPaths,
  isMarkdownPath,
  isRemoveWatchEvent,
  normalizeFsPath,
} from './notesExternalSyncUtils';

const FILE_TREE_RELOAD_DEBOUNCE_MS = 220;
const PENDING_RENAME_TTL_MS = 180;

function getErrorMessage(error: unknown): string {
  if (typeof error === 'string') {
    return error;
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === 'object') {
    const candidate = error as { message?: unknown; toString?: () => string };
    if (typeof candidate.message === 'string') {
      return candidate.message;
    }
    if (typeof candidate.toString === 'function') {
      const value = candidate.toString();
      if (value && value !== '[object Object]') {
        return value;
      }
    }
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function isWatchPermissionError(error: unknown) {
  const message = getErrorMessage(error).toLowerCase();
  return message.includes('fs.watch not allowed') || message.includes('watch not allowed');
}

export function useNotesExternalSync(vaultPath: string | null, notesPath: string) {
  const loadFileTree = useNotesStore((state) => state.loadFileTree);
  const invalidateNoteCache = useNotesStore((state) => state.invalidateNoteCache);
  const syncCurrentNoteFromDisk = useNotesStore((state) => state.syncCurrentNoteFromDisk);
  const applyExternalPathRename = useNotesStore((state) => state.applyExternalPathRename);
  const applyExternalPathDeletion = useNotesStore((state) => state.applyExternalPathDeletion);

  const reloadTimerRef = useRef<number | null>(null);
  const pendingRenameTimerRef = useRef<number | null>(null);
  const pendingRenamesRef = useRef<PendingRenameEntry[]>([]);
  const lastToastKeyRef = useRef<string | null>(null);

  useEffect(() => {
    if (!vaultPath || !notesPath || !isTauri()) {
      return;
    }

    let disposed = false;
    let unwatch: (() => void) | null = null;

    const scheduleFileTreeReload = () => {
      if (reloadTimerRef.current !== null) {
        window.clearTimeout(reloadTimerRef.current);
      }

      reloadTimerRef.current = window.setTimeout(() => {
        reloadTimerRef.current = null;
        void loadFileTree(true);
      }, FILE_TREE_RELOAD_DEBOUNCE_MS);
    };

    const notifyOnce = (key: string, message: string, type: 'warning' | 'info') => {
      if (lastToastKeyRef.current === key) {
        return;
      }

      lastToastKeyRef.current = key;
      useToastStore.getState().addToast(message, type, 5000);
    };

    const notifyCurrentNoteDeletion = (path: string, isDirty: boolean) => {
      if (isDirty) {
        notifyOnce(
          `conflict:${path}`,
          'Current note was deleted outside vlaina while you still have unsaved changes.',
          'warning'
        );
        return;
      }

      notifyOnce(
        `deleted:${path}`,
        'Current note was deleted outside vlaina.',
        'warning'
      );
    };

    const applyExternalDeletion = async (path: string) => {
      const currentNotePath = useNotesStore.getState().currentNote?.path ?? null;
      const isDirty = useNotesStore.getState().isDirty;
      const touchesCurrentNote = Boolean(
        currentNotePath &&
        (currentNotePath === path || currentNotePath.startsWith(`${path}/`))
      );

      await applyExternalPathDeletion(path);

      if (touchesCurrentNote) {
        notifyCurrentNoteDeletion(currentNotePath ?? path, isDirty);
      }
    };

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
        void flushPendingRenameDeletions();
      }, delay);
    };

    const flushPendingRenameDeletions = async () => {
      const { queue, expiredPaths } = flushExpiredPendingRenames(pendingRenamesRef.current, Date.now());
      pendingRenamesRef.current = queue;
      schedulePendingRenameFlush();

      if (expiredPaths.length === 0) {
        return;
      }

      for (const expiredPath of expiredPaths) {
        await applyExternalDeletion(expiredPath);
      }

      scheduleFileTreeReload();
    };

    const run = async () => {
      try {
        unwatch = await watchImmediate(notesPath, async (event) => {
          if (disposed) {
            return;
          }

          await flushPendingRenameDeletions();

          const unexpectedPaths = event.paths.map((path) => {
            const normalizedPath = normalizeFsPath(path);
            return shouldIgnoreExpectedExternalChange(normalizedPath) ? '' : normalizedPath;
          });

          if (unexpectedPaths.every((path) => !path)) {
            return;
          }

          const renamePaths = getRelativeRenameWatchPaths(vaultPath, {
            ...event,
            paths: unexpectedPaths,
          });
          if (renamePaths) {
            const { oldPath, newPath } = renamePaths;

            if (oldPath && newPath) {
              await applyExternalPathRename(oldPath, newPath);
            } else if (oldPath) {
              pendingRenamesRef.current = queuePendingRename(
                pendingRenamesRef.current,
                oldPath,
                Date.now(),
                PENDING_RENAME_TTL_MS
              );
              schedulePendingRenameFlush();
              return;
            } else if (newPath) {
              const { queue, oldPath: matchedOldPath } = matchPendingRename(
                pendingRenamesRef.current,
                Date.now()
              );
              pendingRenamesRef.current = queue;
              schedulePendingRenameFlush();

              if (matchedOldPath) {
                await applyExternalPathRename(matchedOldPath, newPath);
              } else {
                scheduleFileTreeReload();
                return;
              }
            }

            scheduleFileTreeReload();
            return;
          }

          let shouldReloadTree = false;
          let shouldSyncCurrentNote = false;
          const isRemoveEvent = isRemoveWatchEvent(event);
          const currentNotePath = useNotesStore.getState().currentNote?.path ?? null;

          for (const relativePath of getRelevantRelativeWatchPaths(vaultPath, unexpectedPaths)) {
            shouldReloadTree = true;

            if (isRemoveEvent) {
              await applyExternalDeletion(relativePath);

              continue;
            }

            if (!isMarkdownPath(relativePath)) {
              continue;
            }

            if (currentNotePath && !isAbsolutePath(currentNotePath) && currentNotePath === relativePath) {
              shouldSyncCurrentNote = true;
              continue;
            }

            invalidateNoteCache(relativePath);
          }

          if (shouldSyncCurrentNote) {
            const result = await syncCurrentNoteFromDisk();
            if (result === 'reloaded') {
              notifyOnce(
                `reloaded:${currentNotePath ?? ''}`,
                'Current note was updated outside vlaina and has been reloaded.',
                'info'
              );
            } else if (result === 'conflict' || result === 'deleted-conflict') {
              notifyOnce(
                `conflict:${currentNotePath ?? ''}`,
                'Current note changed outside vlaina while you still have unsaved changes.',
                'warning'
              );
            } else if (result === 'deleted') {
              notifyOnce(
                `deleted:${currentNotePath ?? ''}`,
                'Current note was deleted outside vlaina.',
                'warning'
              );
            } else if (result === 'unchanged') {
              lastToastKeyRef.current = null;
            }
          }

          if (shouldReloadTree) {
            scheduleFileTreeReload();
          }
        }, { recursive: true });
      } catch (error) {
        if (disposed) {
          return;
        }

        if (isWatchPermissionError(error)) {
          notifyOnce(
            'external-sync-disabled',
            'External file sync is unavailable in this build.',
            'warning'
          );
          return;
        }

        console.error(
          '[NotesExternalSync] Failed to start filesystem watch:',
          getErrorMessage(error)
        );
      }
    };

    void run();

    return () => {
      disposed = true;
      if (reloadTimerRef.current !== null) {
        window.clearTimeout(reloadTimerRef.current);
        reloadTimerRef.current = null;
      }
      if (pendingRenameTimerRef.current !== null) {
        window.clearTimeout(pendingRenameTimerRef.current);
        pendingRenameTimerRef.current = null;
      }
      pendingRenamesRef.current = [];
      unwatch?.();
    };
  }, [
    applyExternalPathDeletion,
    applyExternalPathRename,
    invalidateNoteCache,
    loadFileTree,
    notesPath,
    syncCurrentNoteFromDisk,
    vaultPath,
  ]);
}
