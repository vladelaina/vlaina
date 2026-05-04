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
  isCreateWatchEvent,
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

export interface PendingCreateEntry {
  newPath: string;
  expiresAt: number;
}

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
  pendingCreatesRef: MutableRefObject<PendingCreateEntry[]>;
  reconcileInFlightRef: MutableRefObject<boolean>;
}

function queuePendingCreate(
  queue: PendingCreateEntry[],
  newPath: string,
  now: number,
  ttlMs: number
): PendingCreateEntry[] {
  return [...flushExpiredPendingCreates(queue, now).queue, { newPath, expiresAt: now + ttlMs }];
}

function matchPendingCreate(
  queue: PendingCreateEntry[],
  now: number
): { queue: PendingCreateEntry[]; newPath: string | null } {
  const { queue: nextQueue } = flushExpiredPendingCreates(queue, now);
  const [matchedEntry, ...remainingQueue] = nextQueue;

  return {
    queue: remainingQueue,
    newPath: matchedEntry?.newPath ?? null,
  };
}

function flushExpiredPendingCreates(
  queue: PendingCreateEntry[],
  now: number
): { queue: PendingCreateEntry[]; expiredPaths: string[] } {
  const expiredPaths: string[] = [];
  const nextQueue: PendingCreateEntry[] = [];

  for (const entry of queue) {
    if (entry.expiresAt <= now) {
      expiredPaths.push(entry.newPath);
      continue;
    }

    nextQueue.push(entry);
  }

  return { queue: nextQueue, expiredPaths };
}

function getNextPendingCreateDelay(queue: PendingCreateEntry[], now: number): number | null {
  const nextExpiresAt = queue.reduce<number | null>((earliest, entry) => {
    if (earliest == null || entry.expiresAt < earliest) {
      return entry.expiresAt;
    }
    return earliest;
  }, null);

  if (nextExpiresAt == null) {
    return null;
  }

  return Math.max(0, nextExpiresAt - now);
}

export function createNotesExternalSyncActions(options: CreateNotesExternalSyncActionsOptions) {
  const {
    notesPath, loadFileTree, invalidateNoteCache, syncCurrentNoteFromDisk,
    applyExternalPathRename, applyExternalPathDeletion,
    reloadTimerRef,
    pendingRenameTimerRef,
    pendingRenamesRef,
    pendingCreatesRef,
    reconcileInFlightRef,
  } = options;

  const { applyExternalDeletion, reconcileCurrentNote } = createCurrentNoteExternalSync({
    syncCurrentNoteFromDisk,
    applyExternalPathDeletion,
  });
  const { clearTimers: clearExternalSyncTimers, scheduleFileTreeReload } = createNotesExternalSyncTimers({
    loadFileTree,
    reloadTimerRef,
    pendingRenameTimerRef,
    pendingRenamesRef,
  });
  const isActiveNotesPath = () => useNotesStore.getState().notesPath === notesPath;

  const schedulePendingRenameFlush = () => {
    if (pendingRenameTimerRef.current !== null) {
      window.clearTimeout(pendingRenameTimerRef.current);
      pendingRenameTimerRef.current = null;
    }

    const now = Date.now();
    const pendingRenameDelay = getNextPendingRenameDelay(pendingRenamesRef.current, now);
    const pendingCreateDelay = getNextPendingCreateDelay(pendingCreatesRef.current, now);
    const delay =
      pendingRenameDelay == null
        ? pendingCreateDelay
        : pendingCreateDelay == null
          ? pendingRenameDelay
          : Math.min(pendingRenameDelay, pendingCreateDelay);
    if (delay == null) {
      return;
    }
    pendingRenameTimerRef.current = window.setTimeout(() => {
      pendingRenameTimerRef.current = null;
      void flushPendingRenameDeletions();
    }, delay);
  };

  const flushPendingRenameDeletions = async () => {
    const now = Date.now();
    const { queue, expiredPaths } = flushExpiredPendingRenames(pendingRenamesRef.current, now);
    const { queue: createQueue, expiredPaths: expiredCreates } = flushExpiredPendingCreates(
      pendingCreatesRef.current,
      now
    );
    pendingRenamesRef.current = queue;
    pendingCreatesRef.current = createQueue;
    schedulePendingRenameFlush();

    if (expiredPaths.length === 0 && expiredCreates.length === 0) {
      return false;
    }

    if (!isActiveNotesPath()) {
      return false;
    }

    if (await reconcileExternalTree()) {
      return true;
    }

    for (const expiredPath of expiredPaths) {
      await applyExternalDeletion(expiredPath);
    }

    if (expiredCreates.length > 0) {
      await handleRelevantPaths(expiredCreates, false);
    }

    if (expiredPaths.length > 0) {
      scheduleFileTreeReload();
    }

    return expiredPaths.length > 0 || expiredCreates.length > 0;
  };

  const handleRelevantPaths = async (relativePaths: string[], isRemoveEvent: boolean) => {
    if (!isActiveNotesPath()) {
      return;
    }

    let shouldReloadTree = false;
    let shouldSyncCurrentNote = false;
    const currentNotePath = useNotesStore.getState().currentNote?.path ?? null;

    for (const relativePath of relativePaths) {
      if (isRemoveEvent) {
        if (!isActiveNotesPath()) {
          return;
        }
        const { queue, newPath } = matchPendingCreate(pendingCreatesRef.current, Date.now());
        pendingCreatesRef.current = queue;
        if (newPath) {
          shouldReloadTree = true;
          await applyExternalPathRename(relativePath, newPath);
          schedulePendingRenameFlush();
          continue;
        }

        pendingRenamesRef.current = queuePendingRename(
          pendingRenamesRef.current,
          relativePath,
          Date.now(),
          PENDING_RENAME_TTL_MS
        );
        schedulePendingRenameFlush();
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

    if (shouldReloadTree && isActiveNotesPath()) {
      scheduleFileTreeReload();
    }
  };

  const handleCreatedPaths = async (relativePaths: string[]) => {
    if (!isActiveNotesPath()) {
      return;
    }

    let handledRename = false;

    for (const relativePath of relativePaths) {
      const { queue, oldPath } = matchPendingRename(pendingRenamesRef.current, Date.now());
      pendingRenamesRef.current = queue;

      if (oldPath) {
        handledRename = true;
        await applyExternalPathRename(oldPath, relativePath);
        if (!isActiveNotesPath()) {
          return;
        }
        continue;
      }

      pendingCreatesRef.current = queuePendingCreate(
        pendingCreatesRef.current,
        relativePath,
        Date.now(),
        PENDING_RENAME_TTL_MS
      );
    }

    schedulePendingRenameFlush();

    if (handledRename && isActiveNotesPath()) {
      scheduleFileTreeReload();
    }
  };

  const clearTimers = () => {
    clearExternalSyncTimers();
    pendingCreatesRef.current = [];
  };

  const reconcileExternalTree = async () => {
    if (!isActiveNotesPath()) {
      return false;
    }
    const previousNodes = useNotesStore.getState().rootFolder?.children ?? [];
    const nextNodes = await buildExternalTreeSnapshot(notesPath);
    if (!isActiveNotesPath()) {
      return false;
    }
    const changes = detectExternalTreePathChanges(previousNodes, nextNodes);

    if (!changes.hasChanges) {
      return false;
    }
    for (const rename of changes.renames) {
      await applyExternalPathRename(rename.oldPath, rename.newPath);
      if (!isActiveNotesPath()) {
        return true;
      }
    }

    for (const deletedPath of changes.deletions) {
      await applyExternalDeletion(deletedPath);
      if (!isActiveNotesPath()) {
        return true;
      }
    }

    if (changes.hasAdditions && isActiveNotesPath()) {
      await loadFileTree(true);
    }

    return true;
  };

  const runPollingReconcile = async () => {
    if (!isActiveNotesPath()) {
      return;
    }

    if (reconcileInFlightRef.current) {
      return;
    }

    reconcileInFlightRef.current = true;
    try {
      const hadPendingChanges = await flushPendingRenameDeletions();
      if (hadPendingChanges) {
        return;
      }
      if (!isActiveNotesPath()) {
        return;
      }
      const hadTreeChanges = await reconcileExternalTree();
      if (!hadTreeChanges && isActiveNotesPath()) {
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
    if (!isActiveNotesPath()) {
      return;
    }

    const { pathDetails, unexpectedPaths } = classifyWatchEventPaths(vaultPath, event.paths);
    if (pathDetails.every((detail) => detail.ignoredByVaultRules)) {
      return;
    }
    if (unexpectedPaths.every((path) => !path)) {
      return;
    }

    await flushPendingRenameDeletions();
    if (!isActiveNotesPath()) {
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
        if (!isActiveNotesPath()) {
          return;
        }
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
          if (!isActiveNotesPath()) {
            return;
          }
        } else {
          pendingCreatesRef.current = queuePendingCreate(
            pendingCreatesRef.current,
            newPath,
            Date.now(),
            PENDING_RENAME_TTL_MS
          );
          schedulePendingRenameFlush();
          return;
        }
      }

      if (isActiveNotesPath()) {
        scheduleFileTreeReload();
      }
      return;
    }

    const relativePaths = getRelevantRelativeWatchPaths(vaultPath, unexpectedPaths);
    if (relativePaths.length === 0) {
      return;
    }

    if (isCreateWatchEvent(event)) {
      await handleCreatedPaths(relativePaths);
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
