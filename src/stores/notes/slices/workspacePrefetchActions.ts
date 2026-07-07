import { isSupportedMarkdownPath } from '@/lib/notes/markdownFile';
import { loadNoteDocument } from '../document/noteDocumentPersistence';
import {
  getExternalPathMutationRevision,
  wasPathExternallyMutatedSince,
} from '../document/externalPathMutationRegistry';
import { markCachedNoteFresh } from '../document/noteContentCache';
import { normalizeNotesRootRelativePath } from '../utils/fs/notesRootPathContainment';
import type { NotesGet, NotesSet, WorkspaceSlice } from './workspaceSliceTypes';
import {
  cancelledNotePrefetches,
  explicitOpenCancelledNotePrefetches,
  getNotePrefetchKey,
  HOVER_PREFETCH_FRESH_MS,
  isCachedNoteFresh,
  isInternalWorkspaceNotePath,
  limitWorkspaceNoteContents,
  MAX_PENDING_NOTE_PREFETCHES,
  notePrefetchQueue,
  pendingNotePrefetches,
} from './workspaceOpenNoteSupport';

export function createWorkspacePrefetchActions(
  set: NotesSet,
  get: NotesGet,
): Pick<WorkspaceSlice, 'prefetchNote' | 'cancelPrefetchNote'> {
  return {
    prefetchNote: async (path: string) => {
      const { notesPath, openTabs } = get();
      if (!isSupportedMarkdownPath(path)) {
        return;
      }
      const normalizedPath = normalizeNotesRootRelativePath(path);
      if (normalizedPath == null) {
        return;
      }
      if (isInternalWorkspaceNotePath(normalizedPath)) {
        return;
      }
      path = normalizedPath;
      if (isCachedNoteFresh(get(), path)) {
        return;
      }
      if (openTabs.some((tab) => tab.path === path && tab.isDirty)) {
        return;
      }
      const pathMutationRevision = getExternalPathMutationRevision();

      const prefetchKey = getNotePrefetchKey(notesPath, path);
      cancelledNotePrefetches.delete(prefetchKey);
      const existing = pendingNotePrefetches.get(prefetchKey);
      if (existing) {
        await existing.promise;
        return;
      }
      if (pendingNotePrefetches.size >= MAX_PENDING_NOTE_PREFETCHES) {
        return;
      }

      const pendingPrefetch = {
        promise: Promise.resolve(),
        started: false,
      };
      const task = notePrefetchQueue.run(async () => {
        pendingPrefetch.started = true;
        if (cancelledNotePrefetches.has(prefetchKey) || explicitOpenCancelledNotePrefetches.has(prefetchKey)) {
          return;
        }

        const stateBeforeLoad = get();
        if (
          stateBeforeLoad.notesPath !== notesPath ||
          isCachedNoteFresh(stateBeforeLoad, path) ||
          stateBeforeLoad.currentNote?.path === path ||
          stateBeforeLoad.openTabs.some((tab) => tab.path === path && tab.isDirty)
        ) {
          return;
        }

        const { nextCache } = await loadNoteDocument({
          notesPath,
          path,
          cache: stateBeforeLoad.noteContentsCache,
        });
        if (
          cancelledNotePrefetches.has(prefetchKey) ||
          explicitOpenCancelledNotePrefetches.has(prefetchKey)
        ) {
          return;
        }
        if (wasPathExternallyMutatedSince(path, pathMutationRevision)) {
          return;
        }

        const freshCache = markCachedNoteFresh(nextCache, path, Date.now() + HOVER_PREFETCH_FRESH_MS);
        const prefetchedEntry = freshCache.get(path);
        if (!prefetchedEntry) {
          return;
        }
        set((state) => {
          if (
            state.notesPath !== notesPath ||
            state.openTabs.some((tab) => tab.path === path && tab.isDirty)
          ) {
            return {};
          }
          const mergedCache = new Map(state.noteContentsCache);
          mergedCache.set(path, prefetchedEntry);
          return {
            noteContentsCache: limitWorkspaceNoteContents(mergedCache, state, [path]),
          };
        });
      });
      pendingPrefetch.promise = task;

      pendingNotePrefetches.set(prefetchKey, pendingPrefetch);
      try {
        await task;
      } catch {
        // Hover prefetch should not replace the explicit open-note error path.
      } finally {
        pendingNotePrefetches.delete(prefetchKey);
        cancelledNotePrefetches.delete(prefetchKey);
        explicitOpenCancelledNotePrefetches.delete(prefetchKey);
      }
    },

    cancelPrefetchNote: (path: string) => {
      const { notesPath } = get();
      if (!notesPath) {
        return;
      }

      const normalizedPath = normalizeNotesRootRelativePath(path);
      if (normalizedPath == null) {
        return;
      }

      const prefetchKey = getNotePrefetchKey(notesPath, normalizedPath);
      const pendingPrefetch = pendingNotePrefetches.get(prefetchKey);
      if (!pendingPrefetch || pendingPrefetch.started) {
        return;
      }

      cancelledNotePrefetches.add(prefetchKey);
    },
  };
}
