import type { MutableRefObject } from 'react';
import type { DesktopWatchEvent } from '@/lib/desktop/watch';
import { isAbsolutePath } from '@/lib/storage/adapter';
import { useNotesStore } from '@/stores/notes/useNotesStore';
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
} from './notesExternalSyncUtils';
import {
  buildExternalTreeSnapshot,
  detectExternalTreePathChanges,
} from './notesExternalPollingUtils';
import { createCurrentNoteExternalSync } from './notesExternalCurrentNoteSync';
import { createNotesExternalSyncTimers } from './notesExternalSyncTimers';
import { classifyWatchEventPaths } from './notesExternalWatchEventDebug';
import { getExternalWatchErrorMessage } from './externalWatchErrorUtils';

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
  reconcileInFlightRef: MutableRefObject<boolean>;
}

export function createNotesExternalSyncActions(options: CreateNotesExternalSyncActionsOptions) {
  const {
    notesPath, loadFileTree, invalidateNoteCache, syncCurrentNoteFromDisk,
    applyExternalPathRename, applyExternalPathDeletion,
    reloadTimerRef,
    pendingRenameTimerRef,
    pendingRenamesRef,
    reconcileInFlightRef,
  } = options;

  const { applyExternalDeletion, reconcileCurrentNote } = createCurrentNoteExternalSync({
    syncCurrentNoteFromDisk,
    applyExternalPathDeletion,
  });
  const { clearTimers, scheduleFileTreeReload } = createNotesExternalSyncTimers({
    loadFileTree,
    reloadTimerRef,
    pendingRenameTimerRef,
    pendingRenamesRef,
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
      if (isRemoveEvent) {
        shouldReloadTree = true;
        await applyExternalDeletion(relativePath);
        continue;
      }

      if (currentNotePath && !isAbsolutePath(currentNotePath) && currentNotePath === relativePath) {
        if (isMarkdownPath(relativePath)) {
          shouldSyncCurrentNote = true;
        }
        continue;
      }
      shouldReloadTree = true;
      if (!isMarkdownPath(relativePath)) {
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
    const { pathDetails, unexpectedPaths } = classifyWatchEventPaths(vaultPath, event.paths);
    if (pathDetails.every((detail) => detail.ignoredByVaultRules)) {
      return;
    }
    if (unexpectedPaths.every((path) => !path)) {
      return;
    }

    await flushPendingRenameDeletions();

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

    const relativePaths = getRelevantRelativeWatchPaths(vaultPath, unexpectedPaths);
    if (relativePaths.length === 0) {
      return;
    }

    await handleRelevantPaths(relativePaths, isRemoveWatchEvent(event));
  };

  return {
    clearTimers,
    handleWatchEvent,
    runPollingReconcile,
  };
}
