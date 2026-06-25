import {
  getBaseName,
  getParentPath,
  getStorageAdapter,
  isAbsolutePath,
  normalizeAbsolutePath,
  relativePath,
} from '@/lib/storage/adapter';
import { getNoteTitleFromPath } from '@/lib/notes/displayName';
import {
  addNodeToTree,
  deepUpdateNodePath,
  findNode,
  removeNodeFromTree,
  updateFileNodePath,
  updateFolderNode,
} from '../fileTreeUtils';
import { isInvalidMoveTarget } from '../utils/fs/moveValidation';
import { resolveUniqueRenamedPath } from '../utils/fs/pathOperations';
import { resolveVaultRelativeFullPath } from '../utils/fs/vaultPathContainment';
import { moveItemImpl, renameNoteImpl } from '../utils/fs/renameOperations';
import { buildSortedRootFolder } from '../utils/fs/rootFolderState';
import { markExpectedExternalChange } from '../document/externalChangeRegistry';
import { emitNotesExternalPathRename } from '../document/externalPathBroadcast';
import { remapMetadataEntries } from '../storage';
import {
  getStarredEntryAbsolutePath,
  getStarredVaultPathComparisonKey,
  getVaultStarredPaths,
  normalizeStarredRelativePath,
  remapStarredEntriesForVault,
  saveStarredRegistry,
} from '../starred';
import { assertValidFileName } from '../noteUtils';
import { hasInternalNotePathSegment } from '../utils/fs/internalNotePaths';
import { hasUnsafeVaultPathSegment } from '../utils/fs/vaultPathContainment';
import {
  remapCurrentNoteForExternalRename,
  remapOpenTabsForExternalRename,
} from '../document/externalPathSync';
import { remapNoteNavigationHistoryForExternalRename } from '../document/noteNavigationHistory';
import { persistWorkspaceSnapshot } from '../workspacePersistence';
import { applyPathRenameState } from './fileSystemSliceHelpers';
import { flushCurrentPendingEditorMarkdown } from '../pendingEditorMarkdownFlusher';
import type { FileSystemSlice, FileSystemSliceGet, FileSystemSliceSet } from './fileSystemSliceContracts';

function isActiveNotesPath(get: FileSystemSliceGet, notesPath: string) {
  return get().notesPath === notesPath;
}

function remapMetadataForRename(
  noteMetadata: ReturnType<FileSystemSliceGet>['noteMetadata'],
  oldPath: string,
  newPath: string,
) {
  return remapMetadataEntries(noteMetadata, (metadataPath) =>
    metadataPath === oldPath || metadataPath.startsWith(`${oldPath}/`)
      ? `${newPath}${metadataPath.slice(oldPath.length)}`
      : metadataPath
  );
}

function getRemappedStarredState(
  starredEntries: ReturnType<FileSystemSliceGet>['starredEntries'],
  notesPath: string,
  remapPath: Parameters<typeof remapStarredEntriesForVault>[2],
) {
  const starredResult = remapStarredEntriesForVault(starredEntries, notesPath, remapPath);
  if (starredResult.changed) {
    void Promise.resolve(saveStarredRegistry(starredResult.entries)).catch(() => undefined);
  }

  const starredPaths = getVaultStarredPaths(starredResult.entries, notesPath);
  return {
    entries: starredResult.entries,
    notes: starredPaths.notes,
    folders: starredPaths.folders,
  };
}

function remapStarredForNoteRename(
  starredEntries: ReturnType<FileSystemSliceGet>['starredEntries'],
  notesPath: string,
  oldPath: string,
  newPath: string,
) {
  return getRemappedStarredState(starredEntries, notesPath, (relativePath, kind) => (
    kind === 'note' && relativePath === oldPath ? newPath : relativePath
  ));
}

function remapStarredForPathRename(
  starredEntries: ReturnType<FileSystemSliceGet>['starredEntries'],
  notesPath: string,
  oldPath: string,
  newPath: string,
) {
  return getRemappedStarredState(starredEntries, notesPath, (relativePath) => {
    if (relativePath === oldPath) {
      return newPath;
    }
    if (relativePath.startsWith(`${oldPath}/`)) {
      return `${newPath}${relativePath.slice(oldPath.length)}`;
    }
    return relativePath;
  });
}

function moveRootFolderChildren(
  children: NonNullable<ReturnType<FileSystemSliceGet>['rootFolder']>['children'],
  sourcePath: string,
  newPath: string,
  targetFolderPath: string,
) {
  const nodeToMove = findNode(children, sourcePath);
  if (!nodeToMove) {
    return children;
  }

  const nodeWithNewPath = deepUpdateNodePath(nodeToMove, sourcePath, newPath);
  const updatedNode = nodeToMove.isFolder
    ? nodeWithNewPath
    : { ...nodeWithNewPath, name: getNoteTitleFromPath(newPath) };
  return addNodeToTree(removeNodeFromTree(children, sourcePath), targetFolderPath, updatedNode);
}

export function createFileSystemRenameActions(
  set: FileSystemSliceSet,
  get: FileSystemSliceGet,
): Pick<FileSystemSlice, 'renameNote' | 'renameAbsoluteNote' | 'renameFolder' | 'moveItem'> {
  return {
    renameNote: async (path: string, newName: string) => {
      flushCurrentPendingEditorMarkdown();
      const {
        notesPath,
        rootFolder,
        noteMetadata,
        fileTreeSortMode,
      } = get();

      try {
        const result = await renameNoteImpl(notesPath, path, newName);
        if (!result) {
          return;
        }
        if (!isActiveNotesPath(get, notesPath)) {
          return;
        }

        const latestState = get();
        const updatedMetadata = remapMetadataForRename(
          latestState.noteMetadata ?? noteMetadata,
          result.sourcePath,
          result.newPath,
        );
        const { nextRecentNotes, nextDisplayNames, nextNoteContentsCache } = applyPathRenameState({
          oldPath: result.sourcePath,
          newPath: result.newPath,
          recentNotes: latestState.recentNotes,
          displayNames: latestState.displayNames,
          noteContentsCache: latestState.noteContentsCache,
        });
        const rootFolderForUpdate = latestState.rootFolder ?? rootFolder;
        const nextRootFolder = buildSortedRootFolder(
          rootFolderForUpdate,
          rootFolderForUpdate
            ? updateFileNodePath(
                rootFolderForUpdate.children,
                result.sourcePath,
                result.newPath,
                getNoteTitleFromPath(result.newPath),
              )
            : [],
          latestState.fileTreeSortMode ?? fileTreeSortMode,
          updatedMetadata,
        );
        const nextCurrentNote = remapCurrentNoteForExternalRename(
          latestState.currentNote,
          result.sourcePath,
          result.newPath,
        );
        const updatedStarred = remapStarredForNoteRename(
          latestState.starredEntries,
          notesPath,
          result.sourcePath,
          result.newPath,
        );

        set({
          starredEntries: updatedStarred.entries,
          starredNotes: updatedStarred.notes,
          starredFolders: updatedStarred.folders,
          noteMetadata: updatedMetadata,
          openTabs: remapOpenTabsForExternalRename(latestState.openTabs, result.sourcePath, result.newPath),
          currentNote: nextCurrentNote,
          currentNoteRevision:
            latestState.currentNote?.path !== nextCurrentNote?.path
              ? latestState.currentNoteRevision + 1
              : latestState.currentNoteRevision,
          recentNotes: nextRecentNotes,
          displayNames: nextDisplayNames,
          noteContentsCache: nextNoteContentsCache,
          ...remapNoteNavigationHistoryForExternalRename(
            latestState.noteNavigationHistory,
            latestState.noteNavigationHistoryIndex,
            result.sourcePath,
            result.newPath,
          ),
          ...(nextRootFolder ? { rootFolder: nextRootFolder } : {}),
        });

        persistWorkspaceSnapshot(notesPath, {
          rootFolder: nextRootFolder ?? rootFolder,
          currentNotePath: nextCurrentNote?.path ?? null,
          fileTreeSortMode: latestState.fileTreeSortMode ?? fileTreeSortMode,
        });
      } catch (error) {
        if (notesPath && !isActiveNotesPath(get, notesPath)) {
          return;
        }
        set({ error: error instanceof Error ? error.message : 'Failed to rename note' });
      }
    },

    renameAbsoluteNote: async (path: string, newName: string) => {
      flushCurrentPendingEditorMarkdown();
      const {
        notesPath,
        noteMetadata,
      } = get();

      try {
        assertValidFileName(newName);
        if (!isAbsolutePath(path)) {
          await get().renameNote(path, newName);
          return;
        }
        if (hasInternalNotePathSegment(path)) {
          throw new Error('Path must not be inside an internal notes folder.');
        }
        if (hasUnsafeVaultPathSegment(normalizeAbsolutePath(path))) {
          throw new Error('Selected file path contains unsupported characters');
        }

        const normalizedPath = normalizeAbsolutePath(path);
        const parentPath = getParentPath(normalizedPath);
        if (!parentPath) {
          return;
        }

        const currentFileName = getBaseName(normalizedPath);
        const {
          relativePath: newFileName,
          fullPath: newPath,
        } = await resolveUniqueRenamedPath(parentPath, currentFileName, newName, false);
        if (newPath === normalizedPath) {
          return;
        }

        const nextTitle = getNoteTitleFromPath(newFileName);
        const storage = getStorageAdapter();
        markExpectedExternalChange(normalizedPath);
        markExpectedExternalChange(newPath);
        await storage.rename(normalizedPath, newPath);
        if (!isActiveNotesPath(get, notesPath)) {
          return;
        }
        emitNotesExternalPathRename({ notesPath: parentPath, oldPath: normalizedPath, newPath });

        let starredChanged = false;
        const normalizedOldPath = normalizedPath.replace(/\\/g, '/');
        const latestState = get();
        const updatedStarredEntries = latestState.starredEntries.map((entry) => {
          if (entry.kind !== 'note') {
            return entry;
          }

          const entryAbsolutePath = getStarredEntryAbsolutePath(entry);
          if (
            !entryAbsolutePath ||
            getStarredVaultPathComparisonKey(entryAbsolutePath) !== getStarredVaultPathComparisonKey(normalizedOldPath)
          ) {
            return entry;
          }

          const nextRelativePath = normalizeStarredRelativePath(relativePath(entry.vaultPath, newPath));
          if (!nextRelativePath || nextRelativePath === entry.relativePath) {
            return entry;
          }

          starredChanged = true;
          return { ...entry, relativePath: nextRelativePath };
        });
        if (starredChanged) {
          void Promise.resolve(saveStarredRegistry(updatedStarredEntries)).catch(() => undefined);
        }

        const updatedTabs = remapOpenTabsForExternalRename(latestState.openTabs, normalizedPath, newPath).map((tab) =>
          tab.path === newPath ? { ...tab, name: nextTitle } : tab
        );
        const updatedMetadata = remapMetadataEntries(latestState.noteMetadata ?? noteMetadata, (metadataPath) =>
          metadataPath === normalizedPath ? newPath : metadataPath
        );
        const { nextRecentNotes, nextDisplayNames, nextNoteContentsCache } = applyPathRenameState({
          oldPath: normalizedPath,
          newPath,
          recentNotes: latestState.recentNotes,
          displayNames: latestState.displayNames,
          noteContentsCache: latestState.noteContentsCache,
        });
        nextDisplayNames.set(newPath, nextTitle);

        const starredPaths = getVaultStarredPaths(updatedStarredEntries, notesPath);
        const nextCurrentNote = latestState.currentNote?.path === normalizedPath
          ? { ...latestState.currentNote, path: newPath }
          : latestState.currentNote;
        set({
          starredEntries: updatedStarredEntries,
          starredNotes: starredPaths.notes,
          starredFolders: starredPaths.folders,
          noteMetadata: updatedMetadata,
          openTabs: updatedTabs,
          currentNote: nextCurrentNote,
          currentNoteRevision:
            latestState.currentNote?.path === normalizedPath
              ? latestState.currentNoteRevision + 1
              : latestState.currentNoteRevision,
          recentNotes: nextRecentNotes,
          displayNames: nextDisplayNames,
          noteContentsCache: nextNoteContentsCache,
          ...remapNoteNavigationHistoryForExternalRename(
            latestState.noteNavigationHistory,
            latestState.noteNavigationHistoryIndex,
            normalizedPath,
            newPath,
          ),
        });
      } catch (error) {
        if (notesPath && !isActiveNotesPath(get, notesPath)) {
          return;
        }
        set({ error: error instanceof Error ? error.message : 'Failed to rename note' });
      }
    },

    renameFolder: async (path: string, newName: string) => {
      flushCurrentPendingEditorMarkdown();
      const {
        notesPath,
        noteMetadata,
      } = get();
      const storage = getStorageAdapter();

      try {
        assertValidFileName(newName);
        const { relativePath: safePath, fullPath } = await resolveVaultRelativeFullPath(notesPath, path);
        const {
          relativePath: newPath,
          fullPath: newFullPath,
          fileName,
        } = await resolveUniqueRenamedPath(notesPath, safePath, newName, true);
        if (newPath === safePath) {
          return;
        }

        markExpectedExternalChange(fullPath, true);
        markExpectedExternalChange(newFullPath, true);
        await storage.rename(fullPath, newFullPath);
        if (!isActiveNotesPath(get, notesPath)) {
          return;
        }
        emitNotesExternalPathRename({ notesPath, oldPath: safePath, newPath });

        const latestState = get();
        const updatedMetadata = remapMetadataForRename(
          latestState.noteMetadata ?? noteMetadata,
          safePath,
          newPath,
        );
        const updatedCurrentNote = remapCurrentNoteForExternalRename(
          latestState.currentNote,
          safePath,
          newPath,
        );
        const { nextRecentNotes, nextDisplayNames, nextNoteContentsCache } = applyPathRenameState({
          oldPath: safePath,
          newPath,
          recentNotes: latestState.recentNotes,
          displayNames: latestState.displayNames,
          noteContentsCache: latestState.noteContentsCache,
        });
        const updatedStarred = remapStarredForPathRename(
          latestState.starredEntries,
          notesPath,
          safePath,
          newPath,
        );

        if (!latestState.rootFolder) {
          set({
            starredEntries: updatedStarred.entries,
            starredFolders: updatedStarred.folders,
            starredNotes: updatedStarred.notes,
            noteMetadata: updatedMetadata,
            recentNotes: nextRecentNotes,
            displayNames: nextDisplayNames,
            noteContentsCache: nextNoteContentsCache,
            openTabs: remapOpenTabsForExternalRename(latestState.openTabs, safePath, newPath),
            currentNote: updatedCurrentNote,
            currentNoteRevision:
              latestState.currentNote?.path !== updatedCurrentNote?.path
                ? latestState.currentNoteRevision + 1
                : latestState.currentNoteRevision,
            ...remapNoteNavigationHistoryForExternalRename(
              latestState.noteNavigationHistory,
              latestState.noteNavigationHistoryIndex,
              safePath,
              newPath,
            ),
          });
          return;
        }

        const nextRootFolder = buildSortedRootFolder(
          latestState.rootFolder,
          updateFolderNode(latestState.rootFolder.children, safePath, fileName, newPath),
          latestState.fileTreeSortMode,
          updatedMetadata,
        );

        set({
          starredEntries: updatedStarred.entries,
          starredFolders: updatedStarred.folders,
          starredNotes: updatedStarred.notes,
          noteMetadata: updatedMetadata,
          recentNotes: nextRecentNotes,
          displayNames: nextDisplayNames,
          noteContentsCache: nextNoteContentsCache,
          rootFolder: nextRootFolder,
          openTabs: remapOpenTabsForExternalRename(latestState.openTabs, safePath, newPath),
          currentNote: updatedCurrentNote,
          currentNoteRevision:
            latestState.currentNote?.path !== updatedCurrentNote?.path
              ? latestState.currentNoteRevision + 1
              : latestState.currentNoteRevision,
          ...remapNoteNavigationHistoryForExternalRename(
            latestState.noteNavigationHistory,
            latestState.noteNavigationHistoryIndex,
            safePath,
            newPath,
          ),
        });

        persistWorkspaceSnapshot(notesPath, {
          rootFolder: nextRootFolder,
          currentNotePath: updatedCurrentNote?.path ?? null,
          fileTreeSortMode: latestState.fileTreeSortMode,
        });
      } catch (error) {
        if (notesPath && !isActiveNotesPath(get, notesPath)) {
          return;
        }
        set({ error: error instanceof Error ? error.message : 'Failed to rename folder' });
      }
    },

    moveItem: async (sourcePath: string, targetFolderPath: string) => {
      flushCurrentPendingEditorMarkdown();
      const {
        notesPath,
        rootFolder,
        currentNote,
        openTabs,
        starredEntries,
        fileTreeSortMode,
        noteMetadata,
      } = get();

      try {
        if (isInvalidMoveTarget(sourcePath, targetFolderPath)) {
          return;
        }

        const result = await moveItemImpl(notesPath, sourcePath, targetFolderPath, {
          rootFolder,
          currentNote,
          openTabs,
          starredEntries,
          noteMetadata,
        });
        if (!isActiveNotesPath(get, notesPath)) {
          return;
        }
        const latestState = get();
        const updatedMetadata = remapMetadataForRename(
          latestState.noteMetadata ?? noteMetadata,
          result.sourcePath,
          result.newPath,
        );
        const nextCurrentNote = remapCurrentNoteForExternalRename(
          latestState.currentNote,
          result.sourcePath,
          result.newPath,
        );
        const { nextRecentNotes, nextDisplayNames, nextNoteContentsCache } = applyPathRenameState({
          oldPath: result.sourcePath,
          newPath: result.newPath,
          recentNotes: latestState.recentNotes,
          displayNames: latestState.displayNames,
          noteContentsCache: latestState.noteContentsCache,
        });
        const latestRootFolder = latestState.rootFolder ?? rootFolder;
        const nextRootFolder = buildSortedRootFolder(
          latestRootFolder,
          latestRootFolder
            ? moveRootFolderChildren(
                latestRootFolder.children,
                result.sourcePath,
                result.newPath,
                result.targetFolderPath,
              )
            : [],
          latestState.fileTreeSortMode ?? fileTreeSortMode,
          updatedMetadata,
        );
        const updatedStarred = remapStarredForPathRename(
          latestState.starredEntries,
          notesPath,
          result.sourcePath,
          result.newPath,
        );

        set({
          starredEntries: updatedStarred.entries,
          starredNotes: updatedStarred.notes,
          starredFolders: updatedStarred.folders,
          noteMetadata: updatedMetadata,
          openTabs: remapOpenTabsForExternalRename(latestState.openTabs, result.sourcePath, result.newPath),
          currentNote: nextCurrentNote,
          currentNoteRevision:
            latestState.currentNote?.path !== nextCurrentNote?.path
              ? latestState.currentNoteRevision + 1
              : latestState.currentNoteRevision,
          recentNotes: nextRecentNotes,
          displayNames: nextDisplayNames,
          noteContentsCache: nextNoteContentsCache,
          ...remapNoteNavigationHistoryForExternalRename(
            latestState.noteNavigationHistory,
            latestState.noteNavigationHistoryIndex,
            result.sourcePath,
            result.newPath,
          ),
          ...(nextRootFolder ? { rootFolder: nextRootFolder } : {}),
        });

        persistWorkspaceSnapshot(notesPath, {
          rootFolder: nextRootFolder ?? rootFolder,
          currentNotePath: nextCurrentNote?.path ?? null,
          fileTreeSortMode: latestState.fileTreeSortMode ?? fileTreeSortMode,
        });
      } catch (error) {
        if (notesPath && !isActiveNotesPath(get, notesPath)) {
          return;
        }
        set({ error: error instanceof Error ? error.message : 'Failed to move item' });
      }
    },
  };
}
