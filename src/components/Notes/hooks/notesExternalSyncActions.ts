import type { MutableRefObject } from 'react';
import type { DesktopWatchEvent } from '@/lib/desktop/watch';
import { isAbsolutePath } from '@/lib/storage/adapter';
import { findNode } from '@/stores/notes/fileTreeUtils';
import { useNotesStore } from '@/stores/notes/useNotesStore';
import {
  flushExpiredPendingRenames,
  getNextPendingRenameDelay,
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
import { classifyWatchEventPaths, hasBlockedRenameEndpoint } from './notesExternalWatchEventDebug';

const PENDING_RENAME_TTL_MS = 180;

type SyncCurrentNoteFromDisk = ReturnType<typeof useNotesStore.getState>['syncCurrentNoteFromDisk'];

export interface PendingCreateEntry {
  newPath: string;
  expiresAt: number;
  kind?: string | null;
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
  ttlMs: number,
  kind?: string | null
): PendingCreateEntry[] {
  return [...flushExpiredPendingCreates(queue, now).queue, { newPath, expiresAt: now + ttlMs, kind }];
}

function matchPendingCreate(
  queue: PendingCreateEntry[],
  now: number
): { queue: PendingCreateEntry[]; newPath: string | null; kind: string | null } {
  const { queue: nextQueue } = flushExpiredPendingCreates(queue, now);
  const [matchedEntry, ...remainingQueue] = nextQueue;

  return {
    queue: remainingQueue,
    newPath: matchedEntry?.newPath ?? null,
    kind: matchedEntry?.kind ?? null,
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

function getWatchEventPathKind(event: DesktopWatchEvent): string | null {
  if (typeof event.type === 'string') {
    return null;
  }

  if ('create' in event.type) {
    return event.type.create.kind ?? null;
  }

  if ('remove' in event.type) {
    return event.type.remove.kind ?? null;
  }

  return null;
}

function getParentPath(path: string): string {
  const index = path.lastIndexOf('/');
  return index >= 0 ? path.slice(0, index) : '';
}

function getBaseName(path: string): string {
  const index = path.lastIndexOf('/');
  return index >= 0 ? path.slice(index + 1) : path;
}

function getRenameEndpointScore(sourcePath: string, candidatePath: string): number {
  let score = 0;
  if (getParentPath(sourcePath) === getParentPath(candidatePath)) {
    score += 2;
  }
  if (getBaseName(sourcePath) === getBaseName(candidatePath)) {
    score += 1;
  }
  return score;
}

function takeBestPendingRename(
  queue: PendingRenameEntry[],
  now: number,
  newPath: string,
  canPairKinds: (oldKind: string | null | undefined, newKind: string | null | undefined) => boolean,
  newKind?: string | null
): { queue: PendingRenameEntry[]; oldPath: string | null; kind: string | null } {
  const { queue: nextQueue } = flushExpiredPendingRenames(queue, now);
  const compatible = nextQueue
    .map((entry, index) => ({ entry, index, score: getRenameEndpointScore(entry.oldPath, newPath) }))
    .filter(({ entry }) => canPairKinds(entry.kind, newKind));
  const bestScore = compatible.reduce<number | null>(
    (best, candidate) => best == null || candidate.score > best ? candidate.score : best,
    null
  );
  const bestCandidates = compatible.filter((candidate) => candidate.score === bestScore);
  if (bestCandidates.length !== 1) {
    return { queue: nextQueue, oldPath: null, kind: null };
  }

  const best = bestCandidates[0];
  return {
    queue: nextQueue.filter((_, index) => index !== best.index),
    oldPath: best.entry.oldPath,
    kind: best.entry.kind ?? null,
  };
}

function takeBestPendingCreate(
  queue: PendingCreateEntry[],
  now: number,
  oldPath: string,
  canPairKinds: (oldKind: string | null | undefined, newKind: string | null | undefined) => boolean,
  oldKind?: string | null
): { queue: PendingCreateEntry[]; newPath: string | null; kind: string | null } {
  const { queue: nextQueue } = flushExpiredPendingCreates(queue, now);
  const compatible = nextQueue
    .map((entry, index) => ({ entry, index, score: getRenameEndpointScore(oldPath, entry.newPath) }))
    .filter(({ entry }) => canPairKinds(oldKind, entry.kind));
  const bestScore = compatible.reduce<number | null>(
    (best, candidate) => best == null || candidate.score > best ? candidate.score : best,
    null
  );
  const bestCandidates = compatible.filter((candidate) => candidate.score === bestScore);
  if (bestCandidates.length !== 1) {
    return { queue: nextQueue, newPath: null, kind: null };
  }

  const best = bestCandidates[0];
  return {
    queue: nextQueue.filter((_, index) => index !== best.index),
    newPath: best.entry.newPath,
    kind: best.entry.kind ?? null,
  };
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
  const isKnownFolderPath = (path: string) => {
    const state = useNotesStore.getState();
    const rootFolder = state.rootFolder;
    const node = rootFolder ? findNode(rootFolder.children, path) : null;
    if (node?.isFolder) {
      return true;
    }

    const childPrefix = `${path}/`;
    return Boolean(
      state.currentNote?.path.startsWith(childPrefix) ||
      state.openTabs.some((tab) => tab.path.startsWith(childPrefix)) ||
      state.recentNotes.some((recentPath) => recentPath.startsWith(childPrefix)) ||
      [...state.noteContentsCache.keys()].some((cachedPath) => cachedPath.startsWith(childPrefix)) ||
      Object.keys(state.noteMetadata?.notes ?? {}).some((metadataPath) => metadataPath.startsWith(childPrefix))
    );
  };
  const isFolderRename = (
    oldPath: string,
    oldKind: string | null | undefined,
    newKind: string | null | undefined
  ) => {
    if (oldKind === 'folder') {
      return true;
    }

    if (oldKind === 'file' || newKind === 'file') {
      return false;
    }

    if (newKind === 'folder') {
      return isKnownFolderPath(oldPath);
    }

    return isKnownFolderPath(oldPath);
  };
  const isUnknownPathKind = (kind: string | null | undefined) => !kind || kind === 'any';
  const canPairPendingRenameKinds = (
    oldKind: string | null | undefined,
    newKind: string | null | undefined
  ) => {
    if (isUnknownPathKind(oldKind) || isUnknownPathKind(newKind)) {
      return true;
    }

    return oldKind === newKind;
  };
  const isRelevantDeletedPath = (path: string, kind: string | null | undefined) => {
    if (kind === 'folder') {
      return true;
    }

    if (kind !== 'file' && isKnownFolderPath(path)) {
      return true;
    }

    return isMarkdownPath(path);
  };
  const isPathWithin = (path: string, basePath: string) => (
    basePath === '' || path === basePath || path.startsWith(`${basePath}/`)
  );

  const applyExternalRenamePathChange = async (
    oldPath: string,
    newPath: string,
    oldKind?: string | null,
    newKind?: string | null
  ) => {
    const hasExplicitFolderEndpoint = oldKind === 'folder' || newKind === 'folder';
    if (
      isFolderRename(oldPath, oldKind, newKind) ||
      (!hasExplicitFolderEndpoint && isMarkdownPath(oldPath) && isMarkdownPath(newPath))
    ) {
      await applyExternalPathRename(oldPath, newPath);
      return true;
    }

    if (isMarkdownPath(oldPath)) {
      await applyExternalDeletion(oldPath);
      return true;
    }

    if (isMarkdownPath(newPath)) {
      invalidateNoteCache(newPath);
      return true;
    }

    return false;
  };

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
      if (isRelevantDeletedPath(expiredPath, null)) {
        await applyExternalDeletion(expiredPath);
      }
    }

    if (expiredCreates.length > 0) {
      await handleRelevantPaths(expiredCreates, false);
    }

    if (expiredPaths.length > 0) {
      scheduleFileTreeReload();
    }

    return expiredPaths.length > 0 || expiredCreates.length > 0;
  };

  const handleRelevantPaths = async (
    relativePaths: string[],
    isRemoveEvent: boolean,
    pathKind?: string | null
  ) => {
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
        const { queue, newPath, kind: newKind } = takeBestPendingCreate(
          pendingCreatesRef.current,
          Date.now(),
          relativePath,
          canPairPendingRenameKinds,
          pathKind
        );
        pendingCreatesRef.current = queue;
        if (newPath) {
          shouldReloadTree = await applyExternalRenamePathChange(relativePath, newPath, pathKind, newKind) || shouldReloadTree;
          schedulePendingRenameFlush();
          continue;
        }

        pendingRenamesRef.current = queuePendingRename(
          pendingRenamesRef.current,
          relativePath,
          Date.now(),
          PENDING_RENAME_TTL_MS,
          pathKind
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
        if (relativePath === '' || pathKind === 'folder' || isKnownFolderPath(relativePath)) {
          invalidateNoteCache(relativePath, { includeDescendants: true });
          if (
            currentNotePath &&
            !isAbsolutePath(currentNotePath) &&
            isPathWithin(currentNotePath, relativePath)
          ) {
            shouldSyncCurrentNote = true;
          }
        }
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

  const handleCreatedPaths = async (relativePaths: string[], pathKind?: string | null) => {
    if (!isActiveNotesPath()) {
      return;
    }

    let handledRename = false;

    for (const relativePath of relativePaths) {
      const { queue, oldPath, kind: oldKind } = takeBestPendingRename(
        pendingRenamesRef.current,
        Date.now(),
        relativePath,
        canPairPendingRenameKinds,
        pathKind
      );
      pendingRenamesRef.current = queue;

      if (oldPath) {
        handledRename = await applyExternalRenamePathChange(oldPath, relativePath, oldKind, pathKind) || handledRename;
        if (!isActiveNotesPath()) {
          return;
        }
        continue;
      }

      pendingCreatesRef.current = queuePendingCreate(
        pendingCreatesRef.current,
        relativePath,
        Date.now(),
        PENDING_RENAME_TTL_MS,
        pathKind
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
      await applyExternalRenamePathChange(rename.oldPath, rename.newPath);
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

  const runPollingReconcile = async (options?: { skipTreeSnapshot?: boolean }) => {
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
      const hadTreeChanges = options?.skipTreeSnapshot
        ? false
        : await reconcileExternalTree();
      if (!hadTreeChanges && isActiveNotesPath()) {
        await reconcileCurrentNote();
      }
    } catch (error) {
    } finally {
      reconcileInFlightRef.current = false;
    }
  };

  const handleExternalPathRename = async (
    oldPath: string,
    newPath: string,
    options?: { reload?: 'immediate' | 'scheduled' }
  ) => {
    if (!isActiveNotesPath()) {
      return;
    }

    const handled = await applyExternalRenamePathChange(oldPath, newPath);
    if (handled && isActiveNotesPath()) {
      if (options?.reload === 'immediate') {
        await loadFileTree(true);
        return;
      }
      scheduleFileTreeReload();
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
    const currentNotePath = useNotesStore.getState().currentNote?.path ?? null;
    const hasExpectedCurrentNoteChange =
      currentNotePath != null &&
      !isAbsolutePath(currentNotePath) &&
      isMarkdownPath(currentNotePath) &&
      pathDetails.some((detail) =>
        detail.expectedChange &&
        !detail.ignoredByVaultRules &&
        detail.relativePath === currentNotePath
      );
    if (hasExpectedCurrentNoteChange) {
      await syncCurrentNoteFromDisk({ force: true, expectedExternalChange: true });
      if (!isActiveNotesPath()) {
        return;
      }
    }
    if (unexpectedPaths.every((path) => !path)) {
      return;
    }

    await flushPendingRenameDeletions();
    if (!isActiveNotesPath()) {
      return;
    }

    const isBlockedRenameEvent = hasBlockedRenameEndpoint(event, pathDetails);
    const renamePaths = isBlockedRenameEvent
      ? null
      : getRelativeRenameWatchPaths(vaultPath, {
          ...event,
          paths: unexpectedPaths,
        });
    if (renamePaths) {
      const { oldPath, newPath } = renamePaths;

      if (oldPath && newPath) {
        await applyExternalRenamePathChange(oldPath, newPath);
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
        const { queue, oldPath: matchedOldPath, kind: matchedOldKind } = takeBestPendingRename(
          pendingRenamesRef.current,
          Date.now(),
          newPath,
          canPairPendingRenameKinds,
          getWatchEventPathKind(event)
        );
        pendingRenamesRef.current = queue;
        schedulePendingRenameFlush();

        if (matchedOldPath) {
          await applyExternalRenamePathChange(matchedOldPath, newPath, matchedOldKind);
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
      await handleCreatedPaths(relativePaths, getWatchEventPathKind(event));
      return;
    }

    await handleRelevantPaths(relativePaths, isRemoveWatchEvent(event), getWatchEventPathKind(event));
  };

  return {
    clearTimers,
    handleExternalPathRename,
    handleWatchEvent,
    runPollingReconcile,
  };
}
