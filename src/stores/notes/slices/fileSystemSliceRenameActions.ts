import {
  getBaseName,
  getParentPath,
  getStorageAdapter,
  isAbsolutePath,
  joinPath,
  relativePath,
} from '@/lib/storage/adapter';
import { getNoteTitleFromPath } from '@/lib/notes/displayName';
import { updateFileNodePath, updateFolderNode } from '../fileTreeUtils';
import { processFolderRename } from '../utils/fs/batchOperations';
import { isInvalidMoveTarget } from '../utils/fs/moveValidation';
import { resolveUniqueRenamedPath } from '../utils/fs/pathOperations';
import { moveItemImpl, renameNoteImpl } from '../utils/fs/renameOperations';
import { buildSortedRootFolder } from '../utils/fs/rootFolderState';
import { markExpectedExternalChange } from '../document/externalChangeRegistry';
import { emitNotesExternalPathRename } from '../document/externalPathBroadcast';
import { remapMetadataEntries } from '../storage';
import {
  getVaultStarredPaths,
  normalizeStarredRelativePath,
  normalizeStarredVaultPath,
  saveStarredRegistry,
} from '../starred';
import {
  remapCurrentNoteForExternalRename,
  remapOpenTabsForExternalRename,
} from '../document/externalPathSync';
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
        currentNote,
        openTabs,
        starredEntries,
        noteMetadata,
        fileTreeSortMode,
      } = get();

      try {
        const result = await renameNoteImpl(notesPath, path, newName, {
          rootFolder,
          currentNote,
          openTabs,
          starredEntries,
          noteMetadata,
        });
        if (!result) {
          return;
        }
        if (!isActiveNotesPath(get, notesPath)) {
          return;
        }

        const latestState = get();
        const updatedMetadata = remapMetadataForRename(
          latestState.noteMetadata ?? noteMetadata,
          path,
          result.newPath,
        );
        const { nextRecentNotes, nextDisplayNames, nextNoteContentsCache } = applyPathRenameState({
          oldPath: path,
          newPath: result.newPath,
          recentNotes: latestState.recentNotes,
          displayNames: latestState.displayNames,
          noteContentsCache: latestState.noteContentsCache,
        });
        const nextRootFolder = buildSortedRootFolder(
          latestState.rootFolder ?? rootFolder,
          latestState.rootFolder
            ? updateFileNodePath(
                latestState.rootFolder.children,
                path,
                result.newPath,
                getNoteTitleFromPath(result.newPath),
              )
            : result.updatedChildren,
          latestState.fileTreeSortMode ?? fileTreeSortMode,
          updatedMetadata,
        );
        const nextCurrentNote = remapCurrentNoteForExternalRename(
          latestState.currentNote,
          path,
          result.newPath,
        );

        set({
          starredEntries: result.updatedStarredEntries,
          starredNotes: result.updatedStarredNotes,
          starredFolders: result.updatedStarredFolders,
          noteMetadata: updatedMetadata,
          openTabs: remapOpenTabsForExternalRename(latestState.openTabs, path, result.newPath),
          currentNote: nextCurrentNote,
          currentNoteRevision:
            latestState.currentNote?.path !== nextCurrentNote?.path
              ? latestState.currentNoteRevision + 1
              : latestState.currentNoteRevision,
          recentNotes: nextRecentNotes,
          displayNames: nextDisplayNames,
          noteContentsCache: nextNoteContentsCache,
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
        if (!isAbsolutePath(path)) {
          await get().renameNote(path, newName);
          return;
        }

        const parentPath = getParentPath(path);
        if (!parentPath) {
          return;
        }

        const currentFileName = getBaseName(path);
        const {
          relativePath: newFileName,
          fullPath: newPath,
        } = await resolveUniqueRenamedPath(parentPath, currentFileName, newName, false);
        if (newPath === path) {
          return;
        }

        const nextTitle = getNoteTitleFromPath(newFileName);
        const storage = getStorageAdapter();
        markExpectedExternalChange(path);
        markExpectedExternalChange(newPath);
        await storage.rename(path, newPath);
        if (!isActiveNotesPath(get, notesPath)) {
          return;
        }
        emitNotesExternalPathRename({ notesPath: parentPath, oldPath: path, newPath });

        let starredChanged = false;
        const normalizedOldPath = path.replace(/\\/g, '/');
        const latestState = get();
        const updatedStarredEntries = latestState.starredEntries.map((entry) => {
          if (entry.kind !== 'note') {
            return entry;
          }

          const normalizedEntryVaultPath = normalizeStarredVaultPath(entry.vaultPath);
          const entryAbsolutePath = normalizedEntryVaultPath === '/'
            ? `/${entry.relativePath}`
            : `${normalizedEntryVaultPath}/${entry.relativePath}`.replace(/\\/g, '/');
          if (entryAbsolutePath !== normalizedOldPath) {
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
          void saveStarredRegistry(updatedStarredEntries);
        }

        const updatedTabs = remapOpenTabsForExternalRename(latestState.openTabs, path, newPath).map((tab) =>
          tab.path === newPath ? { ...tab, name: nextTitle } : tab
        );
        const updatedMetadata = remapMetadataEntries(latestState.noteMetadata ?? noteMetadata, (metadataPath) =>
          metadataPath === path ? newPath : metadataPath
        );
        const { nextRecentNotes, nextDisplayNames, nextNoteContentsCache } = applyPathRenameState({
          oldPath: path,
          newPath,
          recentNotes: latestState.recentNotes,
          displayNames: latestState.displayNames,
          noteContentsCache: latestState.noteContentsCache,
        });
        nextDisplayNames.set(newPath, nextTitle);

        const starredPaths = getVaultStarredPaths(updatedStarredEntries, notesPath);
        const nextCurrentNote = latestState.currentNote?.path === path
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
            latestState.currentNote?.path === path
              ? latestState.currentNoteRevision + 1
              : latestState.currentNoteRevision,
          recentNotes: nextRecentNotes,
          displayNames: nextDisplayNames,
          noteContentsCache: nextNoteContentsCache,
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
        rootFolder,
        currentNote,
        openTabs,
        starredEntries,
        noteMetadata,
      } = get();
      const storage = getStorageAdapter();

      try {
        const fullPath = await joinPath(notesPath, path);
        const {
          relativePath: newPath,
          fullPath: newFullPath,
          fileName,
        } = await resolveUniqueRenamedPath(notesPath, path, newName, true);
        if (newPath === path) {
          return;
        }

        markExpectedExternalChange(fullPath, true);
        markExpectedExternalChange(newFullPath, true);
        await storage.rename(fullPath, newFullPath);
        if (!isActiveNotesPath(get, notesPath)) {
          return;
        }
        emitNotesExternalPathRename({ notesPath, oldPath: path, newPath });

        const result = await processFolderRename(notesPath, path, fileName, {
          rootFolder,
          currentNote,
          openTabs,
          starredEntries,
          noteMetadata,
        });
        const latestState = get();
        const updatedMetadata = remapMetadataForRename(
          latestState.noteMetadata ?? noteMetadata,
          path,
          newPath,
        );
        const updatedCurrentNote = remapCurrentNoteForExternalRename(
          latestState.currentNote,
          path,
          newPath,
        );
        const { nextRecentNotes, nextDisplayNames, nextNoteContentsCache } = applyPathRenameState({
          oldPath: path,
          newPath,
          recentNotes: latestState.recentNotes,
          displayNames: latestState.displayNames,
          noteContentsCache: latestState.noteContentsCache,
        });

        if (!latestState.rootFolder) {
          set({
            starredEntries: result.updatedStarredEntries,
            starredFolders: result.updatedStarredFolders,
            starredNotes: result.updatedStarredNotes,
            noteMetadata: updatedMetadata,
            recentNotes: nextRecentNotes,
            displayNames: nextDisplayNames,
            noteContentsCache: nextNoteContentsCache,
            openTabs: remapOpenTabsForExternalRename(latestState.openTabs, path, newPath),
            currentNote: updatedCurrentNote,
            currentNoteRevision:
              latestState.currentNote?.path !== updatedCurrentNote?.path
                ? latestState.currentNoteRevision + 1
                : latestState.currentNoteRevision,
          });
          return;
        }

        const nextRootFolder = buildSortedRootFolder(
          latestState.rootFolder,
          updateFolderNode(latestState.rootFolder.children, path, fileName, newPath),
          latestState.fileTreeSortMode,
          updatedMetadata,
        );

        set({
          starredEntries: result.updatedStarredEntries,
          starredFolders: result.updatedStarredFolders,
          starredNotes: result.updatedStarredNotes,
          noteMetadata: updatedMetadata,
          recentNotes: nextRecentNotes,
          displayNames: nextDisplayNames,
          noteContentsCache: nextNoteContentsCache,
          rootFolder: nextRootFolder,
          openTabs: remapOpenTabsForExternalRename(latestState.openTabs, path, newPath),
          currentNote: updatedCurrentNote,
          currentNoteRevision:
            latestState.currentNote?.path !== updatedCurrentNote?.path
              ? latestState.currentNoteRevision + 1
              : latestState.currentNoteRevision,
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
        const nextRootFolder = buildSortedRootFolder(
          latestState.rootFolder ?? rootFolder,
          result.newChildren,
          latestState.fileTreeSortMode ?? fileTreeSortMode,
          updatedMetadata,
        );

        set({
          starredEntries: result.updatedStarredEntries,
          starredNotes: result.updatedStarredNotes,
          starredFolders: result.updatedStarredFolders,
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
