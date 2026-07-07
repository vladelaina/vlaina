import { buildSortedRootFolder } from '../utils/fs/rootFolderState';
import { collectExpandedPaths } from '../fileTreeUtils';
import {
  getNotesRootStarredPaths,
  remapStarredEntriesForNotesRoot,
  saveStarredRegistry,
} from '../starred';
import { openStoredNotePath } from '../openNotePath';
import { pruneCachedNoteContents } from '../document/noteContentCache';
import { markExternalPathDeletion } from '../document/externalPathMutationRegistry';
import { pruneRecentlyClosedTabsForExternalDeletion } from '../document/recentlyClosedTabState';
import { pruneNoteNavigationHistoryForExternalDeletion } from '../document/noteNavigationHistory';
import {
  pruneDisplayNamesForExternalDeletion,
  pruneOpenTabsForExternalDeletion,
  pruneRecentNotesForExternalDeletion,
  shouldPreserveDeletedCurrentNote,
  shouldRemoveForExternalDeletion,
} from '../document/externalPathSync';
import { persistRecentNotes, remapMetadataEntries } from '../storage';
import { persistWorkspaceSnapshot } from '../workspacePersistence';
import { flushCurrentPendingEditorMarkdown } from '../pendingEditorMarkdownFlusher';
import { hasInternalNotePathSegment } from '../utils/fs/internalNotePaths';
import type { NotesGet, NotesSet } from './workspaceSliceTypes';
import { pruneStarredEntriesForAbsoluteDeletion } from './workspaceExternalStarred';
import {
  hasPreservedDeletedPath,
  isAllowedExternalActionPath,
  pruneFileTreeForExternalDeletion,
} from './workspaceExternalPathUtils';

export async function applyExternalPathDeletionAction(
  set: NotesSet,
  get: NotesGet,
  path: string,
  options?: { preserveCleanCurrentNote?: boolean },
): Promise<void> {
  if (!isAllowedExternalActionPath(path) || hasInternalNotePathSegment(get().notesPath)) {
    return;
  }

  flushCurrentPendingEditorMarkdown();
  markExternalPathDeletion(path);
  const {
    currentNote,
    openTabs,
    displayNames,
    noteContentsCache,
    noteMetadata,
    starredEntries,
    recentlyClosedTabs,
    noteNavigationHistory,
    noteNavigationHistoryIndex,
    notesPath,
    isDirty,
    recentNotes,
    rootFolder,
    fileTreeSortMode,
  } = get();

  const preserveDirtyCurrentNote = shouldPreserveDeletedCurrentNote(currentNote, isDirty, path);
  const preserveCurrentNote =
    preserveDirtyCurrentNote ||
    Boolean(
      options?.preserveCleanCurrentNote &&
      currentNote &&
      shouldRemoveForExternalDeletion(currentNote.path, path)
    );
  const preservedDeletedPaths = new Set<string>();
  const dirtyPreservedDeletedPaths = new Set<string>();
  if (preserveCurrentNote && currentNote) {
    preservedDeletedPaths.add(currentNote.path);
    if (preserveDirtyCurrentNote) {
      dirtyPreservedDeletedPaths.add(currentNote.path);
    }
  }
  openTabs.forEach((tab) => {
    if (tab.isDirty && shouldRemoveForExternalDeletion(tab.path, path)) {
      preservedDeletedPaths.add(tab.path);
      dirtyPreservedDeletedPaths.add(tab.path);
    }
  });
  const hasPreservedDeletedPaths = preservedDeletedPaths.size > 0;
  const preservedPaths = hasPreservedDeletedPaths ? preservedDeletedPaths : null;
  const nextOpenTabs = pruneOpenTabsForExternalDeletion(openTabs, path, preservedPaths);
  const nextDisplayNames = pruneDisplayNamesForExternalDeletion(displayNames, path, preservedPaths);
  const nextRecentNotes = pruneRecentNotesForExternalDeletion(recentNotes, path, preservedPaths);
  const nextRecentlyClosedTabs = pruneRecentlyClosedTabsForExternalDeletion(recentlyClosedTabs, path);
  const nextNoteNavigationHistory = pruneNoteNavigationHistoryForExternalDeletion(
    noteNavigationHistory,
    noteNavigationHistoryIndex,
    path,
    preservedPaths,
  );
  const nextCache = pruneCachedNoteContents(noteContentsCache, (cachedPath) => {
    if (hasPreservedDeletedPath(preservedDeletedPaths, cachedPath)) return false;
    return shouldRemoveForExternalDeletion(cachedPath, path);
  });

  const nextMetadata = remapMetadataEntries(noteMetadata, (relativePath) => {
    if (hasPreservedDeletedPath(preservedDeletedPaths, relativePath)) return relativePath;
    if (shouldRemoveForExternalDeletion(relativePath, path)) return null;
    return relativePath;
  });

  const starredResult = remapStarredEntriesForNotesRoot(starredEntries, notesPath, (relativePath) => {
    if (preservedDeletedPaths.has(relativePath)) return relativePath;
    if (relativePath === path || relativePath.startsWith(`${path}/`)) return null;
    return relativePath;
  });
  const absoluteStarredResult = pruneStarredEntriesForAbsoluteDeletion(
    starredResult.entries,
    path,
    preservedDeletedPaths,
  );

  const starredChanged = starredResult.changed || absoluteStarredResult.changed;
  if (starredChanged) {
    void Promise.resolve(saveStarredRegistry(absoluteStarredResult.entries)).catch(() => undefined);
  }
  if (nextRecentNotes !== recentNotes) {
    persistRecentNotes(nextRecentNotes);
  }

  const nextRootFolder = rootFolder
    ? buildSortedRootFolder(
        rootFolder,
        pruneFileTreeForExternalDeletion(rootFolder.children, path, preservedPaths),
        fileTreeSortMode,
        nextMetadata ?? noteMetadata
      )
    : rootFolder;
  const starredPaths = getNotesRootStarredPaths(absoluteStarredResult.entries, notesPath);
  const preservedDirtyDeletedCount = dirtyPreservedDeletedPaths.size;
  const deletionConflictError = preservedDirtyDeletedCount > 0
    ? preserveDirtyCurrentNote
      ? 'Current note was deleted outside vlaina while you still have unsaved changes. Its content is preserved; save to restore it.'
      : preservedDirtyDeletedCount === 1
        ? 'A note with unsaved changes was deleted outside vlaina. Its content is preserved; save to restore it.'
        : 'Notes with unsaved changes were deleted outside vlaina. Their content is preserved; save to restore them.'
    : null;
  set({
    openTabs: nextOpenTabs,
    displayNames: nextDisplayNames,
    recentNotes: nextRecentNotes,
    recentlyClosedTabs: nextRecentlyClosedTabs,
    ...nextNoteNavigationHistory,
    noteContentsCache: nextCache,
    noteMetadata: nextMetadata ?? noteMetadata,
    rootFolder: nextRootFolder,
    starredEntries: absoluteStarredResult.entries,
    starredNotes: starredPaths.notes,
    starredFolders: starredPaths.folders,
    error: deletionConflictError,
  });

  const nextCurrentNotePath =
    currentNote && !preserveCurrentNote && shouldRemoveForExternalDeletion(currentNote.path, path)
      ? nextOpenTabs[nextOpenTabs.length - 1]?.path ?? null
      : currentNote?.path ?? null;

  persistWorkspaceSnapshot(notesPath, {
    rootFolder: nextRootFolder,
    currentNotePath: nextCurrentNotePath,
    fileTreeSortMode,
    expandedFolders: nextRootFolder ? Array.from(collectExpandedPaths(nextRootFolder.children)) : [],
  });

  if (currentNote && !preserveCurrentNote && shouldRemoveForExternalDeletion(currentNote.path, path)) {
    if (nextOpenTabs.length > 0) {
      const lastTab = nextOpenTabs[nextOpenTabs.length - 1];
      if (lastTab) {
        void openStoredNotePath(lastTab.path, {
          openNote: get().openNote,
          openNoteByAbsolutePath: get().openNoteByAbsolutePath,
        });
      }
    } else {
      set({ currentNote: null, isDirty: false });
    }
  }
}
