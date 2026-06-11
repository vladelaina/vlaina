import { getNoteTitleFromPath } from '@/lib/notes/displayName';
import { isSupportedMarkdownPath } from '@/lib/notes/markdownFile';
import { getBaseName, getParentPath, isAbsolutePath, normalizeAbsolutePath } from '@/lib/storage/adapter';
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
  markExternalPathDeletion,
  markExternalPathRename,
} from '../document/externalPathMutationRegistry';
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
  shouldRemoveForExternalDeletion,
} from '../document/externalPathSync';
import { persistRecentNotes, remapMetadataEntries } from '../storage';
import { persistWorkspaceSnapshot } from '../workspacePersistence';
import { flushCurrentPendingEditorMarkdown } from '../pendingEditorMarkdownFlusher';
import { hasInternalNotePathSegment } from '../utils/fs/internalNotePaths';
import { hasUnsafeVaultPathSegment, normalizeVaultRelativePath } from '../utils/fs/vaultPathContainment';
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

function pruneStarredEntriesForAbsoluteDeletion(
  entries: StarredEntry[],
  deletedPath: string,
  preservedDeletedPaths: ReadonlySet<string>,
): { entries: StarredEntry[]; changed: boolean } {
  if (!isAbsolutePath(deletedPath)) {
    return { entries, changed: false };
  }

  const normalizedDeletedPath = normalizeStarredVaultPath(deletedPath);
  let changed = false;

  const pruned = entries.filter((entry) => {
    const absolutePath = getStarredEntryAbsolutePath(entry);
    if (!absolutePath) {
      return true;
    }

    const normalizedAbsolutePath = normalizeStarredVaultPath(absolutePath);
    if (preservedDeletedPaths.has(normalizedAbsolutePath)) {
      return true;
    }

    const shouldRemove = normalizedAbsolutePath === normalizedDeletedPath ||
      normalizedAbsolutePath.startsWith(`${normalizedDeletedPath}/`);
    if (shouldRemove) {
      changed = true;
      return false;
    }

    return true;
  });

  return { entries: pruned, changed };
}

function isKnownNoteFilePath(
  input: {
    currentNote: ReturnType<NotesGet>['currentNote'];
    openTabs: ReturnType<NotesGet>['openTabs'];
    recentNotes: ReturnType<NotesGet>['recentNotes'];
    noteContentsCache: ReturnType<NotesGet>['noteContentsCache'];
    noteMetadata: ReturnType<NotesGet>['noteMetadata'];
    notesPath: ReturnType<NotesGet>['notesPath'];
    rootFolder: ReturnType<NotesGet>['rootFolder'];
    starredEntries: ReturnType<NotesGet>['starredEntries'];
  },
  path: string,
) {
  const node = input.rootFolder ? findNode(input.rootFolder.children, path) : null;
  if (node) {
    return !node.isFolder;
  }

  return Boolean(
    input.currentNote?.path === path ||
    input.openTabs.some((tab) => tab.path === path) ||
    input.recentNotes.includes(path) ||
    input.noteContentsCache.has(path) ||
    Object.prototype.hasOwnProperty.call(input.noteMetadata?.notes ?? {}, path) ||
    input.starredEntries.some((entry) => {
      if (entry.kind !== 'note') {
        return false;
      }

      if (entry.vaultPath === input.notesPath && entry.relativePath === path) {
        return true;
      }

      return isAbsolutePath(path) && getStarredEntryAbsolutePath(entry) === path;
    })
  );
}

function hasUnsafeExternalPathSegment(path: string): boolean {
  const normalizedPath = isAbsolutePath(path) ? normalizeAbsolutePath(path) : path;
  return hasUnsafeVaultPathSegment(normalizedPath, {
    allowNavigationSegments: true,
  });
}

function isAllowedExternalActionPath(path: string): boolean {
  const normalizedPath = isAbsolutePath(path) ? normalizeAbsolutePath(path) : path;
  if (hasInternalNotePathSegment(normalizedPath) || hasUnsafeExternalPathSegment(normalizedPath)) {
    return false;
  }

  return isAbsolutePath(normalizedPath) || normalizeVaultRelativePath(normalizedPath) != null;
}

export function createWorkspaceExternalActions(
  set: NotesSet,
  get: NotesGet
): Pick<WorkspaceSlice, 'applyExternalPathRename' | 'applyExternalPathDeletion'> {
  return {
    applyExternalPathRename: async (oldPath: string, newPath: string) => {
      const oldPathAllowed = isAllowedExternalActionPath(oldPath);
      const newPathAllowed = isAllowedExternalActionPath(newPath);
      if (!oldPathAllowed || !newPathAllowed || hasInternalNotePathSegment(get().notesPath)) {
        const normalizedNewPath = isAbsolutePath(newPath) ? normalizeAbsolutePath(newPath) : newPath;
        if (oldPathAllowed && !newPathAllowed && hasInternalNotePathSegment(normalizedNewPath)) {
          await get().applyExternalPathDeletion(oldPath);
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
        oldPath !== newPath && !shouldRemoveForExternalDeletion(newPath, oldPath);
      const displayNamesForRename = shouldDropExistingRenameTarget
        ? pruneDisplayNamesForExternalDeletion(displayNames, newPath)
        : displayNames;
      const cacheForRename = shouldDropExistingRenameTarget
        ? pruneCachedNoteContents(
            noteContentsCache,
            (path) => path === newPath || path.startsWith(`${newPath}/`),
          )
        : noteContentsCache;
      const metadataForRename = shouldDropExistingRenameTarget
        ? remapMetadataEntries(noteMetadata, (path) => (
            path === newPath || path.startsWith(`${newPath}/`) ? null : path
          ))
        : noteMetadata;
      const nextDisplayNames = remapDisplayNamesForExternalRename(displayNamesForRename, oldPath, newPath);
      const nextRecentNotes = remapRecentNotesForExternalRename(recentNotes, oldPath, newPath);
      const nextRecentlyClosedTabs = remapRecentlyClosedTabsForExternalRename(recentlyClosedTabs, oldPath, newPath);
      const nextCache = remapCachedNoteContents(cacheForRename, (path) => {
        if (path === oldPath) return newPath;
        if (path.startsWith(`${oldPath}/`)) return `${newPath}${path.slice(oldPath.length)}`;
        return path;
      });

      const nextMetadata = remapMetadataEntries(metadataForRename, (path) => {
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
        notesPath,
        isDirty,
        recentNotes,
        rootFolder,
        fileTreeSortMode,
      } = get();

      const preserveCurrentNote = shouldPreserveDeletedCurrentNote(currentNote, isDirty, path);
      const preservedDeletedPaths = new Set<string>();
      if (preserveCurrentNote && currentNote) {
        preservedDeletedPaths.add(currentNote.path);
      }
      openTabs.forEach((tab) => {
        if (tab.isDirty && shouldRemoveForExternalDeletion(tab.path, path)) {
          preservedDeletedPaths.add(tab.path);
        }
      });
      const hasPreservedDeletedPaths = preservedDeletedPaths.size > 0;
      const preservedPaths = hasPreservedDeletedPaths ? preservedDeletedPaths : null;
      const nextOpenTabs = pruneOpenTabsForExternalDeletion(openTabs, path, preservedPaths);
      const nextDisplayNames = pruneDisplayNamesForExternalDeletion(displayNames, path, preservedPaths);
      const nextRecentNotes = pruneRecentNotesForExternalDeletion(recentNotes, path, preservedPaths);
      const nextRecentlyClosedTabs = pruneRecentlyClosedTabsForExternalDeletion(recentlyClosedTabs, path);
      const nextCache = pruneCachedNoteContents(noteContentsCache, (cachedPath) => {
        if (preservedDeletedPaths.has(cachedPath)) return false;
        return cachedPath === path || cachedPath.startsWith(`${path}/`);
      });

      const nextMetadata = remapMetadataEntries(noteMetadata, (relativePath) => {
        if (preservedDeletedPaths.has(relativePath)) return relativePath;
        if (relativePath === path || relativePath.startsWith(`${path}/`)) return null;
        return relativePath;
      });

      const starredResult = remapStarredEntriesForVault(starredEntries, notesPath, (relativePath) => {
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
        void saveStarredRegistry(absoluteStarredResult.entries);
      }
      if (nextRecentNotes !== recentNotes) {
        persistRecentNotes(nextRecentNotes);
      }

      const nextRootFolder = rootFolder
        ? buildSortedRootFolder(
            rootFolder,
            hasPreservedDeletedPaths ? rootFolder.children : removeNodeFromTree(rootFolder.children, path),
            fileTreeSortMode,
            nextMetadata ?? noteMetadata
          )
        : rootFolder;
      const starredPaths = getVaultStarredPaths(absoluteStarredResult.entries, notesPath);
      set({
        openTabs: nextOpenTabs,
        displayNames: nextDisplayNames,
        recentNotes: nextRecentNotes,
        recentlyClosedTabs: nextRecentlyClosedTabs,
        noteContentsCache: nextCache,
        noteMetadata: nextMetadata ?? noteMetadata,
        rootFolder: nextRootFolder,
        starredEntries: absoluteStarredResult.entries,
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
