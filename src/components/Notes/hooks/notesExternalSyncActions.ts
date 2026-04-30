import type { MutableRefObject } from 'react';
import type { DesktopWatchEvent } from '@/lib/desktop/watch';
import { isAbsolutePath } from '@/lib/storage/adapter';
import { useNotesStore } from '@/stores/notes/useNotesStore';
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
import {
  buildExternalTreeSnapshot,
  detectExternalTreePathChanges,
} from './notesExternalPollingUtils';
import { createCurrentNoteExternalSync } from './notesExternalCurrentNoteSync';
import { getExternalWatchErrorMessage } from './externalWatchErrorUtils';

const FILE_TREE_RELOAD_DEBOUNCE_MS = 220;
const PENDING_RENAME_TTL_MS = 180;

type SyncCurrentNoteFromDisk = ReturnType<typeof useNotesStore.getState>['syncCurrentNoteFromDisk'];

interface CreateNotesExternalSyncActionsOptions {
  notesPath: string;
  loadFileTree: ReturnType<typeof useNotesStore.getState>['loadFileTree'];
  invalidateNoteCache: ReturnType<typeof useNotesStore.getState>['invalidateNoteCache'];
  syncCurrentNoteFromDisk: SyncCurrentNoteFromDisk;
  applyExternalPathRename: ReturnType<typeof useNotesStore.getState>['applyExternalPathRename'];
  applyExternalPathDeletion: ReturnType<typeof useNotesStore.getState>['applyExternalPathDeletion'];
  reloadTimerRef: MutableRefObject<number | null>;
  pendingRenameTimerRef: MutableRefObject<number | null>;
  pendingRenamesRef: MutableRefObject<PendingRenameEntry[]>;
  lastToastKeyRef: MutableRefObject<string | null>;
  reconcileInFlightRef: MutableRefObject<boolean>;
}

export function createNotesExternalSyncActions(options: CreateNotesExternalSyncActionsOptions) {
  const {
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
  } = options;

  const scheduleFileTreeReload = () => {
    if (reloadTimerRef.current !== null) {
      window.clearTimeout(reloadTimerRef.current);
    }

    reloadTimerRef.current = window.setTimeout(() => {
      reloadTimerRef.current = null;
      void loadFileTree(true);
    }, FILE_TREE_RELOAD_DEBOUNCE_MS);
  };

  const { applyExternalDeletion, reconcileCurrentNote } = createCurrentNoteExternalSync({
    syncCurrentNoteFromDisk,
    applyExternalPathDeletion,
    lastToastKeyRef,
  });

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
      await reconcileCurrentNote({ force: true });
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
      await flushPendingRenameDeletions();
      const hadTreeChanges = await reconcileExternalTree();
      if (!hadTreeChanges) {
        await reconcileCurrentNote();
      }
    } catch (error) {
      console.error(
        '[NotesExternalSync] Poll reconcile failed:',
        getExternalWatchErrorMessage(error)
      );
    } finally {
      reconcileInFlightRef.current = false;
    }
  };

  const handleWatchEvent = async (vaultPath: string, event: DesktopWatchEvent) => {
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

    await handleRelevantPaths(
      getRelevantRelativeWatchPaths(vaultPath, unexpectedPaths),
      isRemoveWatchEvent(event)
    );
  };

  const clearTimers = () => {
    if (reloadTimerRef.current !== null) {
      window.clearTimeout(reloadTimerRef.current);
      reloadTimerRef.current = null;
    }
    if (pendingRenameTimerRef.current !== null) {
      window.clearTimeout(pendingRenameTimerRef.current);
      pendingRenameTimerRef.current = null;
    }
    pendingRenamesRef.current = [];
  };

  return {
    clearTimers,
    handleWatchEvent,
    runPollingReconcile,
  };
}
