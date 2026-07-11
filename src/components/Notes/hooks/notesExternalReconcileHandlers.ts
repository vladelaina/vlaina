import { isAbsolutePath } from '@/lib/storage/adapter';
import { useNotesStore } from '@/stores/notes/useNotesStore';
import { flushExpiredPendingRenames, getNextPendingRenameDelay, queuePendingRename } from './notesExternalRenameQueue';
import { buildExternalTreeSnapshot, detectExternalTreePathChanges } from './notesExternalPollingUtils';
import { isImagePath, isMarkdownPath } from './notesExternalSyncUtils';
import {
  flushExpiredPendingCreates,
  getNextPendingCreateDelay,
  queuePendingCreate,
  takeBestPendingCreate,
  takeBestPendingRename,
} from './notesExternalPendingPaths';
import {
  PENDING_RENAME_TTL_MS,
} from './notesExternalSyncActionTypes';
import type { NotesExternalSyncContext } from './notesExternalSyncContext';

export function createNotesExternalReconcileHandlers(ctx: NotesExternalSyncContext) {
  const schedulePendingRenameFlush = () => {
    if (ctx.pendingRenameTimerRef.current !== null) {
      window.clearTimeout(ctx.pendingRenameTimerRef.current);
      ctx.pendingRenameTimerRef.current = null;
    }

    const now = Date.now();
    const pendingRenameDelay = getNextPendingRenameDelay(ctx.pendingRenamesRef.current, now);
    const pendingCreateDelay = getNextPendingCreateDelay(ctx.pendingCreatesRef.current, now);
    const delay =
      pendingRenameDelay == null
        ? pendingCreateDelay
        : pendingCreateDelay == null
          ? pendingRenameDelay
          : Math.min(pendingRenameDelay, pendingCreateDelay);
    if (delay == null) {
      return;
    }
    ctx.pendingRenameTimerRef.current = window.setTimeout(() => {
      ctx.pendingRenameTimerRef.current = null;
      void flushPendingRenameDeletions().catch(() => undefined);
    }, delay);
  };

  const flushPendingRenameDeletions = async () => {
    const now = Date.now();
    const { queue, expiredEntries } = flushExpiredPendingRenames(ctx.pendingRenamesRef.current, now);
    const { queue: createQueue, expiredEntries: expiredCreates } = flushExpiredPendingCreates(
      ctx.pendingCreatesRef.current,
      now
    );
    const hadPendingQueueOverflow = ctx.consumePendingPathQueueOverflowed();
    ctx.pendingRenamesRef.current = queue;
    ctx.pendingCreatesRef.current = createQueue;
    schedulePendingRenameFlush();

    if (expiredEntries.length === 0 && expiredCreates.length === 0 && !hadPendingQueueOverflow) {
      return false;
    }

    if (!ctx.isActiveNotesPath()) {
      return false;
    }

    if (await reconcileExternalTree()) {
      return true;
    }

    let handledExpiredDelete = false;
    for (const expiredEntry of expiredEntries) {
      if (ctx.isRelevantDeletedPath(expiredEntry.oldPath, expiredEntry.kind)) {
        await ctx.applyExternalDeletion(expiredEntry.oldPath);
        handledExpiredDelete = true;
      } else if (isImagePath(expiredEntry.oldPath)) {
        handledExpiredDelete = true;
      }
    }

    let handledExpiredCreate = false;
    for (const expiredCreate of expiredCreates) {
      handledExpiredCreate =
        await handleRelevantPaths([expiredCreate.newPath], false, expiredCreate.kind) ||
        handledExpiredCreate;
    }

    if (handledExpiredDelete || hadPendingQueueOverflow) {
      ctx.scheduleFileTreeReload();
    }

    return handledExpiredDelete || handledExpiredCreate || hadPendingQueueOverflow;
  };

  const handleRelevantPaths = async (
    relativePaths: string[],
    isRemoveEvent: boolean,
    pathKind?: string | null
  ) => {
    if (!ctx.isActiveNotesPath()) {
      return false;
    }

    let shouldReloadTree = false;
    let shouldSyncCurrentNote = false;
    const currentNotePath = useNotesStore.getState().currentNote?.path ?? null;

    for (const relativePath of relativePaths) {
      if (isRemoveEvent) {
        if (!ctx.isActiveNotesPath()) {
          return;
        }
        const { queue, newPath, kind: newKind } = takeBestPendingCreate(
          ctx.pendingCreatesRef.current,
          Date.now(),
          relativePath,
          ctx.canPairPendingRenameKinds,
          pathKind
        );
        ctx.pendingCreatesRef.current = queue;
        if (newPath) {
          shouldReloadTree = await ctx.applyExternalRenamePathChange(relativePath, newPath, pathKind, newKind) || shouldReloadTree;
          schedulePendingRenameFlush();
          continue;
        }

        ctx.pendingRenamesRef.current = ctx.capPendingPathQueue(queuePendingRename(
          ctx.pendingRenamesRef.current,
          relativePath,
          Date.now(),
          PENDING_RENAME_TTL_MS,
          pathKind
        ));
        schedulePendingRenameFlush();
        continue;
      }

      const isMarkdownEventPath = isMarkdownPath(relativePath);
      const isImageEventPath = isImagePath(relativePath);
      if (currentNotePath && !isAbsolutePath(currentNotePath) && currentNotePath === relativePath) {
        if (isMarkdownEventPath) {
          shouldSyncCurrentNote = true;
        }
        continue;
      }
      if (!isMarkdownEventPath) {
        if (isImageEventPath) {
          shouldReloadTree = true;
          continue;
        }
        if (relativePath === '' || pathKind === 'folder' || ctx.isKnownFolderPath(relativePath)) {
          shouldReloadTree = true;
          ctx.invalidateNoteCache(relativePath, { includeDescendants: true });
          if (
            currentNotePath &&
            !isAbsolutePath(currentNotePath) &&
            ctx.isPathWithin(currentNotePath, relativePath)
          ) {
            shouldSyncCurrentNote = true;
          }
        } else if (pathKind !== 'file') {
          shouldReloadTree = true;
        }
        continue;
      }
      shouldReloadTree = true;
      ctx.invalidateNoteCache(relativePath);
    }

    if (shouldSyncCurrentNote) {
      await ctx.reconcileCurrentNote({ force: true });
    }

    if (shouldReloadTree && ctx.isActiveNotesPath()) {
      ctx.scheduleFileTreeReload();
    }

    return shouldReloadTree || shouldSyncCurrentNote;
  };

  const handleCreatedPaths = async (relativePaths: string[], pathKind?: string | null) => {
    if (!ctx.isActiveNotesPath()) {
      return;
    }

    let handledRename = false;

    for (const relativePath of relativePaths) {
      const { queue, oldPath, kind: oldKind } = takeBestPendingRename(
        ctx.pendingRenamesRef.current,
        Date.now(),
        relativePath,
        ctx.canPairPendingRenameKinds,
        pathKind
      );
      ctx.pendingRenamesRef.current = queue;

      if (oldPath) {
        handledRename = await ctx.applyExternalRenamePathChange(oldPath, relativePath, oldKind, pathKind) || handledRename;
        if (!ctx.isActiveNotesPath()) {
          return;
        }
        continue;
      }

      ctx.pendingCreatesRef.current = ctx.capPendingPathQueue(queuePendingCreate(
        ctx.pendingCreatesRef.current,
        relativePath,
        Date.now(),
        PENDING_RENAME_TTL_MS,
        pathKind
      ));
    }

    schedulePendingRenameFlush();

    if (handledRename && ctx.isActiveNotesPath()) {
      ctx.scheduleFileTreeReload();
    }
  };

  const reconcileExternalTree = async () => {
    if (!ctx.isActiveNotesPath()) {
      return false;
    }
    const previousNodes = useNotesStore.getState().rootFolder?.children ?? [];
    const nextNodes = await buildExternalTreeSnapshot(ctx.notesPath);
    if (!ctx.isActiveNotesPath()) {
      return false;
    }
    const changes = detectExternalTreePathChanges(previousNodes, nextNodes);

    if (!changes.hasChanges) {
      return false;
    }
    let shouldReloadTree = changes.hasAdditions;
    for (const rename of changes.renames) {
      const handled = await ctx.applyExternalRenamePathChange(rename.oldPath, rename.newPath);
      shouldReloadTree = !handled || shouldReloadTree;
      if (!ctx.isActiveNotesPath()) {
        return true;
      }
    }

    for (const deletedPath of changes.deletions) {
      if (ctx.isRelevantDeletedPath(deletedPath, undefined)) {
        await ctx.applyExternalDeletion(deletedPath);
      } else {
        shouldReloadTree = true;
      }
      if (!ctx.isActiveNotesPath()) {
        return true;
      }
    }

    if (shouldReloadTree && ctx.isActiveNotesPath()) {
      await ctx.loadFileTree(true);
    }

    return true;
  };

  const runPollingReconcile = async (options?: { skipTreeSnapshot?: boolean }) => {
    if (!ctx.isActiveNotesPath() || ctx.reconcileInFlightRef.current) {
      return;
    }

    ctx.reconcileInFlightRef.current = true;
    try {
      const hadPendingChanges = await flushPendingRenameDeletions();
      if (hadPendingChanges || !ctx.isActiveNotesPath()) {
        return;
      }
      const hadTreeChanges = options?.skipTreeSnapshot
        ? false
        : await reconcileExternalTree();
      if (!hadTreeChanges && ctx.isActiveNotesPath()) {
        await ctx.reconcileCurrentNote();
      }
    } catch (error) {
    } finally {
      ctx.reconcileInFlightRef.current = false;
    }
  };

  return {
    flushPendingRenameDeletions,
    handleCreatedPaths,
    handleRelevantPaths,
    reconcileExternalTree,
    runPollingReconcile,
    schedulePendingRenameFlush,
  };
}
