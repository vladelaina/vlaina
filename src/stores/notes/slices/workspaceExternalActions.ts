import { getNoteTitleFromPath } from '@/lib/notes/displayName';
import { getBaseName, getParentPath, isAbsolutePath } from '@/lib/storage/adapter';
import { buildSortedRootFolder } from '../utils/fs/rootFolderState';
import {
  collectExpandedPaths,
  findNode,
  removeNodeFromTree,
  updateFileNodePath,
  updateFolderNode,
} from '../fileTreeUtils';
import {
  dedupeStarredEntries,
  getStarredEntryAbsolutePath,
  getVaultStarredPaths,
  normalizeStarredVaultPath,
  remapStarredEntriesForVault,
  resolveStarredRelativePathForVault,
  saveStarredRegistry,
} from '../starred';
import { openStoredNotePath } from '../openNotePath';
import {
  pruneCachedNoteContents,
  remapCachedNoteContents,
} from '../document/noteContentCache';
import {
  pruneRecentlyClosedTabsForExternalDeletion,
  remapRecentlyClosedTabsForExternalRename,
} from '../document/recentlyClosedTabState';
import {
  pruneDisplayNamesForExternalDeletion,
  pruneExpandedFoldersForExternalDeletion,
  pruneOpenTabsForExternalDeletion,
  pruneRecentNotesForExternalDeletion,
  remapCurrentNoteForExternalRename,
  remapPathForExternalRename,
  remapDisplayNamesForExternalRename,
  remapExpandedFoldersForExternalRename,
  remapOpenTabsForExternalRename,
  remapRecentNotesForExternalRename,
  shouldPreserveDeletedCurrentNote,
} from '../document/externalPathSync';
import { persistRecentNotes, remapMetadataEntries } from '../storage';
import { persistWorkspaceSnapshot } from '../workspacePersistence';
import { flushCurrentPendingEditorMarkdown } from '../pendingEditorMarkdownFlusher';
import type { NotesGet, NotesSet, WorkspaceSlice } from './workspaceSliceTypes';
import type { StarredEntry } from '../types';

function remapStarredEntriesForAbsoluteRename(
  entries: StarredEntry[],
  oldPath: string,
  newPath: string,
): { entries: StarredEntry[]; changed: boolean } {
  if (!isAbsolutePath(oldPath) || !isAbsolutePath(newPath)) {
    return { entries, changed: false };
  }

  const normalizedOldPath = normalizeStarredVaultPath(oldPath);
  const normalizedNewPath = normalizeStarredVaultPath(newPath);
  let changed = false;

  const remapped = entries.flatMap((entry) => {
    const absolutePath = getStarredEntryAbsolutePath(entry);
    if (!absolutePath) {
      return [entry];
    }

    const normalizedAbsolutePath = normalizeStarredVaultPath(absolutePath);
    const nextAbsolutePath = remapPathForExternalRename(
      normalizedAbsolutePath,
      normalizedOldPath,
      normalizedNewPath,
    );
    if (nextAbsolutePath === normalizedAbsolutePath) {
      return [entry];
    }

    const relativePath = resolveStarredRelativePathForVault(nextAbsolutePath, entry.vaultPath);
    if (relativePath) {
      changed = true;
      return [{ ...entry, relativePath }];
    }

    const parentPath = getParentPath(nextAbsolutePath);
    const baseName = getBaseName(nextAbsolutePath);
    if (!parentPath || !baseName) {
      changed = true;
      return [];
    }

    changed = true;
    return [{
      ...entry,
      vaultPath: normalizeStarredVaultPath(parentPath),
      relativePath: baseName,
    }];
  });

  const deduped = dedupeStarredEntries(remapped);
  if (deduped.length !== remapped.length) {
    changed = true;
  }

  return { entries: deduped, changed };
}

export function createWorkspaceExternalActions(
  set: NotesSet,
  get: NotesGet
): Pick<WorkspaceSlice, 'applyExternalPathRename' | 'applyExternalPathDeletion'> {
  return {
    applyExternalPathRename: async (oldPath: string, newPath: string) => {
      flushCurrentPendingEditorMarkdown();
      const {
        currentNote,
        openTabs,
        displayNames,
        noteContentsCache,
        noteMetadata,
        starredEntries,
        recentlyClosedTabs,
        notesPath,
        recentNotes,
        rootFolder,
        fileTreeSortMode,
      } = get();

      const nextCurrentNote = remapCurrentNoteForExternalRename(currentNote, oldPath, newPath);
      const nextOpenTabs = remapOpenTabsForExternalRename(openTabs, oldPath, newPath);
      const nextDisplayNames = remapDisplayNamesForExternalRename(displayNames, oldPath, newPath);
      const nextRecentNotes = remapRecentNotesForExternalRename(recentNotes, oldPath, newPath);
      const nextRecentlyClosedTabs = remapRecentlyClosedTabsForExternalRename(recentlyClosedTabs, oldPath, newPath);
      const nextCache = remapCachedNoteContents(noteContentsCache, (path) => {
        if (path === oldPath) return newPath;
        if (path.startsWith(`${oldPath}/`)) return `${newPath}${path.slice(oldPath.length)}`;
        return path;
      });

      const nextMetadata = remapMetadataEntries(noteMetadata, (path) => {
        if (path === oldPath) return newPath;
        if (path.startsWith(`${oldPath}/`)) return `${newPath}${path.slice(oldPath.length)}`;
        return path;
      });

      const vaultStarredResult = remapStarredEntriesForVault(starredEntries, notesPath, (relativePath) => {
        if (relativePath === oldPath) return newPath;
        if (relativePath.startsWith(`${oldPath}/`)) return `${newPath}${relativePath.slice(oldPath.length)}`;
        return relativePath;
      });
      const starredResult = remapStarredEntriesForAbsoluteRename(
        vaultStarredResult.entries,
        oldPath,
        newPath,
      );
      const starredChanged = vaultStarredResult.changed || starredResult.changed;

      if (starredChanged) {
        void saveStarredRegistry(starredResult.entries);
      }
      if (nextRecentNotes !== recentNotes) {
        persistRecentNotes(nextRecentNotes);
      }

      const renamedNode = rootFolder ? findNode(rootFolder.children, oldPath) : null;
      const nextRootFolder = rootFolder
        ? buildSortedRootFolder(
            rootFolder,
            renamedNode?.isFolder
              ? updateFolderNode(rootFolder.children, oldPath, getNoteTitleFromPath(newPath), newPath)
              : updateFileNodePath(rootFolder.children, oldPath, newPath, getNoteTitleFromPath(newPath)),
            fileTreeSortMode,
            nextMetadata ?? noteMetadata
          )
        : rootFolder;
      const starredPaths = getVaultStarredPaths(starredResult.entries, notesPath);
      set({
        currentNote: nextCurrentNote,
        openTabs: nextOpenTabs,
        displayNames: nextDisplayNames,
        recentNotes: nextRecentNotes,
        recentlyClosedTabs: nextRecentlyClosedTabs,
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
    },

    applyExternalPathDeletion: async (path: string) => {
      flushCurrentPendingEditorMarkdown();
      const {
        currentNote,
        openTabs,
        displayNames,
        noteContentsCache,
        noteMetadata,
        starredEntries,
        recentlyClosedTabs,
        notesPath,
        isDirty,
        recentNotes,
        rootFolder,
        fileTreeSortMode,
      } = get();

      const preserveCurrentNote = shouldPreserveDeletedCurrentNote(currentNote, isDirty, path);
      const preservedPath = preserveCurrentNote ? currentNote?.path ?? null : null;
      const nextOpenTabs = pruneOpenTabsForExternalDeletion(openTabs, path, preservedPath);
      const nextDisplayNames = pruneDisplayNamesForExternalDeletion(displayNames, path, preservedPath);
      const nextRecentNotes = pruneRecentNotesForExternalDeletion(recentNotes, path, preservedPath);
      const nextRecentlyClosedTabs = pruneRecentlyClosedTabsForExternalDeletion(recentlyClosedTabs, path);
      const nextCache = pruneCachedNoteContents(noteContentsCache, (cachedPath) => {
        if (preservedPath && cachedPath === preservedPath) return false;
        return cachedPath === path || cachedPath.startsWith(`${path}/`);
      });

      const nextMetadata = remapMetadataEntries(noteMetadata, (relativePath) => {
        if (preservedPath && relativePath === preservedPath) return relativePath;
        if (relativePath === path || relativePath.startsWith(`${path}/`)) return null;
        return relativePath;
      });

      const starredResult = remapStarredEntriesForVault(starredEntries, notesPath, (relativePath) => {
        if (preservedPath && relativePath === preservedPath) return relativePath;
        if (relativePath === path || relativePath.startsWith(`${path}/`)) return null;
        return relativePath;
      });

      if (starredResult.changed) {
        void saveStarredRegistry(starredResult.entries);
      }
      if (nextRecentNotes !== recentNotes) {
        persistRecentNotes(nextRecentNotes);
      }

      const nextRootFolder = rootFolder
        ? buildSortedRootFolder(
            rootFolder,
            preserveCurrentNote ? rootFolder.children : removeNodeFromTree(rootFolder.children, path),
            fileTreeSortMode,
            nextMetadata ?? noteMetadata
          )
        : rootFolder;
      const starredPaths = getVaultStarredPaths(starredResult.entries, notesPath);
      set({
        openTabs: nextOpenTabs,
        displayNames: nextDisplayNames,
        recentNotes: nextRecentNotes,
        recentlyClosedTabs: nextRecentlyClosedTabs,
        noteContentsCache: nextCache,
        noteMetadata: nextMetadata ?? noteMetadata,
        rootFolder: nextRootFolder,
        starredEntries: starredResult.entries,
        starredNotes: starredPaths.notes,
        starredFolders: starredPaths.folders,
        error: null,
      });

      const nextCurrentNotePath =
        currentNote && !preserveCurrentNote && (currentNote.path === path || currentNote.path.startsWith(`${path}/`))
          ? nextOpenTabs[nextOpenTabs.length - 1]?.path ?? null
          : currentNote?.path ?? null;

      persistWorkspaceSnapshot(notesPath, {
        rootFolder: nextRootFolder,
        currentNotePath: nextCurrentNotePath,
        fileTreeSortMode,
        expandedFolders: nextRootFolder
          ? pruneExpandedFoldersForExternalDeletion(
              Array.from(collectExpandedPaths(nextRootFolder.children)),
              path
            )
          : [],
      });

      if (currentNote && !preserveCurrentNote && (currentNote.path === path || currentNote.path.startsWith(`${path}/`))) {
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
    },
  };
}
