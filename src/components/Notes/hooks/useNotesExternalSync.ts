import { useEffect, useRef, useSyncExternalStore } from 'react';
import { watchImmediate } from '@tauri-apps/plugin-fs';
import { isAbsolutePath, isTauri } from '@/lib/storage/adapter';
import { useNotesStore } from '@/stores/notes/useNotesStore';
import { useToastStore } from '@/stores/useToastStore';
import { shouldIgnoreExpectedExternalChange } from '@/stores/notes/document/externalChangeRegistry';
import {
  isExternalSyncPaused,
  registerExternalSyncWatcher,
  subscribeExternalSyncPause,
} from '@/stores/notes/document/externalSyncControl';
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
import {
  getExternalWatchErrorMessage,
  isExternalWatchUnavailableError,
} from './externalWatchErrorUtils';
import {
  buildExternalTreeSnapshot,
  detectExternalTreePathChanges,
} from './notesExternalPollingUtils';
import { logNotesDebug } from '@/stores/notes/debugLog';

const FILE_TREE_RELOAD_DEBOUNCE_MS = 220;
const PENDING_RENAME_TTL_MS = 180;
const NOTES_RECONCILE_POLL_MS = 1500;

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
    if (!vaultPath || !notesPath || !isTauri() || isPaused) {
      return;
    }

    let disposed = false;
    let unwatch: (() => void) | null = null;
    let releaseWatcher: (() => void) | null = null;
    let reconcilePollTimer: number | null = null;

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


    const reconcileCurrentNote = async () => {
      const currentNotePath = useNotesStore.getState().currentNote?.path ?? null;
      if (!currentNotePath) {
        logNotesDebug('useNotesExternalSync:reconcileCurrentNote:ignored-no-current-note');
        return;
      }

      const result = await syncCurrentNoteFromDisk();
      logNotesDebug('useNotesExternalSync:reconcileCurrentNote:result', {
        currentNotePath,
        result,
      });
      if (result === 'reloaded') {
        notifyOnce(
          `reloaded:${currentNotePath}`,
          'Current note was updated outside vlaina and has been reloaded.',
          'info'
        );
      } else if (result === 'conflict' || result === 'deleted-conflict') {
        notifyOnce(
          `conflict:${currentNotePath}`,
          'Current note changed outside vlaina while you still have unsaved changes.',
          'warning'
        );
      } else if (result === 'deleted') {
        notifyOnce(
          `deleted:${currentNotePath}`,
          'Current note was deleted outside vlaina.',
          'warning'
        );
      } else if (result === 'unchanged') {
        lastToastKeyRef.current = null;
      }
    };

    const applyExternalDeletion = async (path: string) => {
      const currentNotePath = useNotesStore.getState().currentNote?.path ?? null;
      const isDirty = useNotesStore.getState().isDirty;
      const touchesCurrentNote = Boolean(
        currentNotePath &&
        (currentNotePath === path || currentNotePath.startsWith(`${path}/`))
      );

      logNotesDebug('useNotesExternalSync:applyExternalDeletion:start', {
        path,
        currentNotePath,
        isDirty,
        touchesCurrentNote,
      });

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

    const handleRelevantPaths = async (relativePaths: string[], isRemoveEvent: boolean) => {
      let shouldReloadTree = false;
      let shouldSyncCurrentNote = false;
      const currentNotePath = useNotesStore.getState().currentNote?.path ?? null;

      for (const relativePath of relativePaths) {
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
        await reconcileCurrentNote();
      }

      if (shouldReloadTree) {
        scheduleFileTreeReload();
      }
    };

    const reconcileExternalTree = async () => {
      const previousNodes = useNotesStore.getState().rootFolder?.children ?? [];
      const nextNodes = await buildExternalTreeSnapshot(notesPath);
      const changes = detectExternalTreePathChanges(previousNodes, nextNodes);

      if (!changes.hasChanges) {
        return false;
      }

      for (const rename of changes.renames) {
        await applyExternalPathRename(rename.oldPath, rename.newPath);
      }

      for (const deletedPath of changes.deletions) {
        await applyExternalDeletion(deletedPath);
      }

      if (changes.hasAdditions) {
        await loadFileTree(true);
      }

      return true;
    };

    const runPollingReconcile = async () => {
      if (reconcileInFlightRef.current) {
        return;
      }

      reconcileInFlightRef.current = true;
      try {
        logNotesDebug('useNotesExternalSync:polling-reconcile:start', {
          currentNotePath: useNotesStore.getState().currentNote?.path ?? null,
        });
        await flushPendingRenameDeletions();
        const hadTreeChanges = await reconcileExternalTree();
        if (!hadTreeChanges) {
          await reconcileCurrentNote();
        }
        logNotesDebug('useNotesExternalSync:polling-reconcile:finish', {
          hadTreeChanges,
          currentNotePath: useNotesStore.getState().currentNote?.path ?? null,
        });
      } catch (error) {
        console.error(
          '[NotesExternalSync] Poll reconcile failed:',
          getExternalWatchErrorMessage(error)
        );
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
        void runPollingReconcile();
      }, NOTES_RECONCILE_POLL_MS);
      void runPollingReconcile();
    };

    const reconcileOnFocus = () => {
      void runPollingReconcile();
    };

    const reconcileOnVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void runPollingReconcile();
      }
    };

    const run = async () => {
      try {
        unwatch = await watchImmediate(notesPath, async (event) => {
          if (disposed) {
            return;
          }

          logNotesDebug('useNotesExternalSync:watch-event', {
            event,
          });

          await flushPendingRenameDeletions();

          const unexpectedPaths = event.paths.map((path) => {
            const normalizedPath = normalizeFsPath(path);
            return shouldIgnoreExpectedExternalChange(normalizedPath) ? '' : normalizedPath;
          });

          logNotesDebug('useNotesExternalSync:watch-event:filtered', {
            paths: event.paths,
            unexpectedPaths,
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

          await handleRelevantPaths(
            getRelevantRelativeWatchPaths(vaultPath, unexpectedPaths),
            isRemoveWatchEvent(event)
          );
        }, { recursive: true });
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
