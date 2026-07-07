import { getNoteTitleFromPath } from '@/lib/notes/displayName';
import { isSupportedMarkdownPath } from '@/lib/notes/markdownFile';
import { isAbsolutePath, normalizeAbsolutePath } from '@/lib/storage/adapter';
import { buildSortedRootFolder } from '../utils/fs/rootFolderState';
import {
  collectExpandedPaths,
  findNode,
  removeNodeFromTree,
  updateFileNodePath,
  updateFolderNode,
} from '../fileTreeUtils';
import {
  getNotesRootStarredPaths,
  remapStarredEntriesForNotesRoot,
  saveStarredRegistry,
} from '../starred';
import {
  pruneCachedNoteContents,
  remapCachedNoteContents,
} from '../document/noteContentCache';
import { markExternalPathRename } from '../document/externalPathMutationRegistry';
import { remapRecentlyClosedTabsForExternalRename } from '../document/recentlyClosedTabState';
import { remapNoteNavigationHistoryForExternalRename } from '../document/noteNavigationHistory';
import {
  pruneDisplayNamesForExternalDeletion,
  remapCurrentNoteForExternalRename,
  remapDisplayNamesForExternalRename,
  remapExpandedFoldersForExternalRename,
  remapOpenTabsForExternalRename,
  remapPathForExternalRename,
  remapRecentNotesForExternalRename,
  isSameExternalPath,
  shouldRemoveForExternalDeletion,
} from '../document/externalPathSync';
import { persistRecentNotes, remapMetadataEntries } from '../storage';
import { persistWorkspaceSnapshot } from '../workspacePersistence';
import { flushCurrentPendingEditorMarkdown } from '../pendingEditorMarkdownFlusher';
import { hasInternalNotePathSegment } from '../utils/fs/internalNotePaths';
import type { NotesGet, NotesSet } from './workspaceSliceTypes';
import { remapStarredEntriesForAbsoluteRename } from './workspaceExternalStarred';
import { isAllowedExternalActionPath, isKnownNoteFilePath } from './workspaceExternalPathUtils';

export async function applyExternalPathRenameAction(
  set: NotesSet,
  get: NotesGet,
  oldPath: string,
  newPath: string,
): Promise<void> {
  const oldPathAllowed = isAllowedExternalActionPath(oldPath);
  const newPathAllowed = isAllowedExternalActionPath(newPath);
  if (!oldPathAllowed || !newPathAllowed || hasInternalNotePathSegment(get().notesPath)) {
    const normalizedNewPath = isAbsolutePath(newPath) ? normalizeAbsolutePath(newPath) : newPath;
    if (oldPathAllowed && !newPathAllowed && hasInternalNotePathSegment(normalizedNewPath)) {
      await get().applyExternalPathDeletion(oldPath, { preserveCleanCurrentNote: true });
    }
    return;
  }

  flushCurrentPendingEditorMarkdown();
  markExternalPathRename(oldPath);
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
    recentNotes,
    rootFolder,
    fileTreeSortMode,
  } = get();

  if (
    isKnownNoteFilePath({
      currentNote,
      openTabs,
      recentNotes,
      noteContentsCache,
      noteMetadata,
      notesPath,
      rootFolder,
      starredEntries,
    }, oldPath) &&
    !isSupportedMarkdownPath(newPath)
  ) {
    await get().applyExternalPathDeletion(oldPath);
    return;
  }

  const nextCurrentNote = remapCurrentNoteForExternalRename(currentNote, oldPath, newPath);
  const nextOpenTabs = remapOpenTabsForExternalRename(openTabs, oldPath, newPath);
  const shouldDropExistingRenameTarget =
    !isSameExternalPath(oldPath, newPath) && !shouldRemoveForExternalDeletion(newPath, oldPath);
  const displayNamesForRename = shouldDropExistingRenameTarget
    ? pruneDisplayNamesForExternalDeletion(displayNames, newPath)
    : displayNames;
  const cacheForRename = shouldDropExistingRenameTarget
    ? pruneCachedNoteContents(
        noteContentsCache,
        (path) => shouldRemoveForExternalDeletion(path, newPath),
      )
    : noteContentsCache;
  const metadataForRename = shouldDropExistingRenameTarget
    ? remapMetadataEntries(noteMetadata, (path) => (
        shouldRemoveForExternalDeletion(path, newPath) ? null : path
      ))
    : noteMetadata;
  const nextDisplayNames = remapDisplayNamesForExternalRename(displayNamesForRename, oldPath, newPath);
  const nextRecentNotes = remapRecentNotesForExternalRename(recentNotes, oldPath, newPath);
  const nextRecentlyClosedTabs = remapRecentlyClosedTabsForExternalRename(recentlyClosedTabs, oldPath, newPath);
  const nextNoteNavigationHistory = remapNoteNavigationHistoryForExternalRename(
    noteNavigationHistory,
    noteNavigationHistoryIndex,
    oldPath,
    newPath,
  );
  const nextCache = remapCachedNoteContents(cacheForRename, (path) => {
    return remapPathForExternalRename(path, oldPath, newPath);
  });

  const nextMetadata = remapMetadataEntries(metadataForRename, (path) => {
    return remapPathForExternalRename(path, oldPath, newPath);
  });

  const notesRootStarredResult = remapStarredEntriesForNotesRoot(starredEntries, notesPath, (relativePath) => {
    if (relativePath === oldPath) return newPath;
    if (relativePath.startsWith(`${oldPath}/`)) return `${newPath}${relativePath.slice(oldPath.length)}`;
    return relativePath;
  });
  const starredResult = remapStarredEntriesForAbsoluteRename(
    notesRootStarredResult.entries,
    oldPath,
    newPath,
  );
  const starredChanged = notesRootStarredResult.changed || starredResult.changed;

  if (starredChanged) {
    void Promise.resolve(saveStarredRegistry(starredResult.entries)).catch(() => undefined);
  }
  if (nextRecentNotes !== recentNotes) {
    persistRecentNotes(nextRecentNotes);
  }

  const renamedNode = rootFolder ? findNode(rootFolder.children, oldPath) : null;
  const renamedNodeTitle = getNoteTitleFromPath(newPath);
  const treeChildrenWithoutRenameTarget =
    rootFolder && shouldDropExistingRenameTarget
      ? removeNodeFromTree(rootFolder.children, newPath)
      : rootFolder?.children;
  const nextRootFolder = rootFolder
    ? buildSortedRootFolder(
        rootFolder,
        renamedNode?.isFolder
          ? updateFolderNode(treeChildrenWithoutRenameTarget ?? [], oldPath, renamedNodeTitle, newPath)
          : updateFileNodePath(treeChildrenWithoutRenameTarget ?? [], oldPath, newPath, renamedNodeTitle),
        fileTreeSortMode,
        nextMetadata ?? noteMetadata
      )
    : rootFolder;
  const starredPaths = getNotesRootStarredPaths(starredResult.entries, notesPath);
  set({
    currentNote: nextCurrentNote,
    openTabs: nextOpenTabs,
    displayNames: nextDisplayNames,
    recentNotes: nextRecentNotes,
    recentlyClosedTabs: nextRecentlyClosedTabs,
    ...nextNoteNavigationHistory,
    noteContentsCache: nextCache,
    noteMetadata: nextMetadata ?? noteMetadata,
    rootFolder: nextRootFolder,
    starredEntries: starredResult.entries,
    starredNotes: starredPaths.notes,
    starredFolders: starredPaths.folders,
    error: null,
  });

  persistWorkspaceSnapshot(notesPath, {
    rootFolder: nextRootFolder,
    currentNotePath: nextCurrentNote?.path ?? null,
    fileTreeSortMode,
    expandedFolders: nextRootFolder
      ? remapExpandedFoldersForExternalRename(
          Array.from(collectExpandedPaths(nextRootFolder.children)),
          oldPath,
          newPath
        )
      : [],
  });
}
