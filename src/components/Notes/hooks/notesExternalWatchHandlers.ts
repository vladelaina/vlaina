import type { DesktopWatchEvent } from '@/lib/desktop/watch';
import { isAbsolutePath } from '@/lib/storage/adapter';
import { useNotesStore } from '@/stores/notes/useNotesStore';
import { queuePendingRename } from './notesExternalRenameQueue';
import {
  getRelativeRenameWatchPaths,
  getRelevantRelativeWatchPaths,
  isCreateWatchEvent,
  isMarkdownPath,
  isRemoveWatchEvent,
} from './notesExternalSyncUtils';
import { classifyWatchEventPaths, hasBlockedRenameEndpoint } from './notesExternalWatchEventDebug';
import {
  getWatchEventPathKind,
  queuePendingCreate,
  takeBestPendingRename,
} from './notesExternalPendingPaths';
import {
  MAX_EXTERNAL_WATCH_EVENT_PATHS,
  PENDING_RENAME_TTL_MS,
} from './notesExternalSyncActionTypes';
import type { NotesExternalSyncContext } from './notesExternalSyncContext';
import type { createNotesExternalReconcileHandlers } from './notesExternalReconcileHandlers';

type ReconcileHandlers = ReturnType<typeof createNotesExternalReconcileHandlers>;

export function createNotesExternalWatchHandlers(
  ctx: NotesExternalSyncContext,
  reconcile: ReconcileHandlers,
) {
  const handleExternalPathRename = async (
    oldPath: string,
    newPath: string,
    options?: { reload?: 'immediate' | 'scheduled' }
  ) => {
    if (!ctx.isActiveNotesPath()) {
      return;
    }

    const handled = await ctx.applyExternalRenamePathChange(oldPath, newPath);
    if (handled && ctx.isActiveNotesPath()) {
      if (options?.reload === 'immediate') {
        await ctx.loadFileTree(true);
        return;
      }
      ctx.scheduleFileTreeReload();
    }
  };

  const handleWatchEvent = async (notesRootPath: string, event: DesktopWatchEvent) => {
    if (!ctx.isActiveNotesPath()) {
      return;
    }

    if (event.paths.length > MAX_EXTERNAL_WATCH_EVENT_PATHS) {
      ctx.setPendingPathQueueOverflowed();
      await reconcile.runPollingReconcile();
      return;
    }

    const { pathDetails, unexpectedPaths } = classifyWatchEventPaths(notesRootPath, event.paths);
    if (pathDetails.every((detail) => detail.ignoredByNotesRootRules)) {
      return;
    }
    const currentNotePath = useNotesStore.getState().currentNote?.path ?? null;
    const hasExpectedCurrentNoteChange =
      currentNotePath != null &&
      !isAbsolutePath(currentNotePath) &&
      isMarkdownPath(currentNotePath) &&
      pathDetails.some((detail) =>
        detail.expectedChange &&
        !detail.ignoredByNotesRootRules &&
        detail.relativePath === currentNotePath
      );
    if (hasExpectedCurrentNoteChange) {
      await ctx.syncCurrentNoteFromDisk({ force: true, expectedExternalChange: true });
      if (!ctx.isActiveNotesPath()) {
        return;
      }
    }
    if (unexpectedPaths.every((path) => !path)) {
      return;
    }

    await reconcile.flushPendingRenameDeletions();
    if (!ctx.isActiveNotesPath()) {
      return;
    }

    const isBlockedRenameEvent = hasBlockedRenameEndpoint(event, pathDetails);
    const renamePaths = isBlockedRenameEvent
      ? null
      : getRelativeRenameWatchPaths(notesRootPath, {
          ...event,
          paths: unexpectedPaths,
        });
    if (renamePaths) {
      await handleRenameWatchPaths(notesRootPath, event, renamePaths);
      return;
    }

    const relativePaths = getRelevantRelativeWatchPaths(notesRootPath, unexpectedPaths);
    if (relativePaths.length === 0) {
      return;
    }

    if (isCreateWatchEvent(event)) {
      await reconcile.handleCreatedPaths(relativePaths, getWatchEventPathKind(event));
      return;
    }

    await reconcile.handleRelevantPaths(relativePaths, isRemoveWatchEvent(event), getWatchEventPathKind(event));
  };

  const handleRenameWatchPaths = async (
    _notesRootPath: string,
    event: DesktopWatchEvent,
    renamePaths: { oldPath: string | null; newPath: string | null },
  ) => {
    const { oldPath, newPath } = renamePaths;

    if (oldPath && newPath) {
      await ctx.applyExternalRenamePathChange(oldPath, newPath);
      if (!ctx.isActiveNotesPath()) {
        return;
      }
    } else if (oldPath) {
      ctx.pendingRenamesRef.current = ctx.capPendingPathQueue(queuePendingRename(
        ctx.pendingRenamesRef.current,
        oldPath,
        Date.now(),
        PENDING_RENAME_TTL_MS
      ));
      reconcile.schedulePendingRenameFlush();
      return;
    } else if (newPath) {
      const { queue, oldPath: matchedOldPath, kind: matchedOldKind } = takeBestPendingRename(
        ctx.pendingRenamesRef.current,
        Date.now(),
        newPath,
        ctx.canPairPendingRenameKinds,
        getWatchEventPathKind(event)
      );
      ctx.pendingRenamesRef.current = queue;
      reconcile.schedulePendingRenameFlush();

      if (matchedOldPath) {
        await ctx.applyExternalRenamePathChange(matchedOldPath, newPath, matchedOldKind);
        if (!ctx.isActiveNotesPath()) {
          return;
        }
      } else {
        ctx.pendingCreatesRef.current = ctx.capPendingPathQueue(queuePendingCreate(
          ctx.pendingCreatesRef.current,
          newPath,
          Date.now(),
          PENDING_RENAME_TTL_MS
        ));
        reconcile.schedulePendingRenameFlush();
        return;
      }
    }

    if (ctx.isActiveNotesPath()) {
      ctx.scheduleFileTreeReload();
    }
  };

  return {
    clearTimers() {
      ctx.clearExternalSyncTimers();
      ctx.pendingCreatesRef.current = [];
    },
    handleExternalPathRename,
    handleWatchEvent,
  };
}
