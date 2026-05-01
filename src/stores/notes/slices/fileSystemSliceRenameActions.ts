import {
  getBaseName,
  getParentPath,
  getStorageAdapter,
  isAbsolutePath,
  joinPath,
  relativePath,
} from '@/lib/storage/adapter';
import { getNoteTitleFromPath } from '@/lib/notes/displayName';
import { updateFolderNode } from '../fileTreeUtils';
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
import { remapOpenTabsForExternalRename } from '../document/externalPathSync';
import { persistWorkspaceSnapshot } from '../workspacePersistence';
import { applyPathRenameState } from './fileSystemSliceHelpers';
import type { FileSystemSlice, FileSystemSliceGet, FileSystemSliceSet } from './fileSystemSliceContracts';

export function createFileSystemRenameActions(
  set: FileSystemSliceSet,
  get: FileSystemSliceGet,
): Pick<FileSystemSlice, 'renameNote' | 'renameAbsoluteNote' | 'renameFolder' | 'moveItem'> {
  return {
    renameNote: async (path: string, newName: string) => {
      const {
        notesPath,
        rootFolder,
        currentNote,
        openTabs,
        starredEntries,
        noteMetadata,
        fileTreeSortMode,
        noteContentsCache,
        recentNotes,
        displayNames,
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

        const { nextRecentNotes, nextDisplayNames, nextNoteContentsCache } = applyPathRenameState({
          oldPath: path,
          newPath: result.newPath,
          recentNotes,
          displayNames,
          noteContentsCache,
        });
        const nextRootFolder = buildSortedRootFolder(
          rootFolder,
          result.updatedChildren,
          fileTreeSortMode,
          result.updatedMetadata,
        );

        set({
          starredEntries: result.updatedStarredEntries,
          starredNotes: result.updatedStarredNotes,
          starredFolders: result.updatedStarredFolders,
          noteMetadata: result.updatedMetadata,
          openTabs: result.updatedTabs,
          currentNote: result.nextCurrentNote,
          recentNotes: nextRecentNotes,
          displayNames: nextDisplayNames,
          noteContentsCache: nextNoteContentsCache,
          ...(nextRootFolder ? { rootFolder: nextRootFolder } : {}),
        });

        persistWorkspaceSnapshot(notesPath, {
          rootFolder: nextRootFolder ?? rootFolder,
          currentNotePath: result.nextCurrentNote?.path ?? null,
          fileTreeSortMode,
        });
      } catch (error) {
        set({ error: error instanceof Error ? error.message : 'Failed to rename note' });
      }
    },

    renameAbsoluteNote: async (path: string, newName: string) => {
      const {
        notesPath,
        currentNote,
        openTabs,
        starredEntries,
        noteMetadata,
        noteContentsCache,
        recentNotes,
        displayNames,
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
        emitNotesExternalPathRename({ notesPath: parentPath, oldPath: path, newPath });

        let starredChanged = false;
        const normalizedOldPath = path.replace(/\\/g, '/');
        const updatedStarredEntries = starredEntries.map((entry) => {
          if (entry.kind !== 'note') {
            return entry;
          }

          const entryAbsolutePath = `${normalizeStarredVaultPath(entry.vaultPath)}/${entry.relativePath}`.replace(/\\/g, '/');
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

        const updatedTabs = remapOpenTabsForExternalRename(openTabs, path, newPath).map((tab) =>
          tab.path === newPath ? { ...tab, name: nextTitle } : tab
        );
        const updatedMetadata = remapMetadataEntries(noteMetadata, (metadataPath) =>
          metadataPath === path ? newPath : metadataPath
        );
        const { nextRecentNotes, nextDisplayNames, nextNoteContentsCache } = applyPathRenameState({
          oldPath: path,
          newPath,
          recentNotes,
          displayNames,
          noteContentsCache,
        });
        nextDisplayNames.set(newPath, nextTitle);

        const starredPaths = getVaultStarredPaths(updatedStarredEntries, notesPath);
        set({
          starredEntries: updatedStarredEntries,
          starredNotes: starredPaths.notes,
          starredFolders: starredPaths.folders,
          noteMetadata: updatedMetadata,
          openTabs: updatedTabs,
          currentNote: currentNote?.path === path ? { ...currentNote, path: newPath } : currentNote,
          currentNoteRevision: currentNote?.path === path ? get().currentNoteRevision + 1 : get().currentNoteRevision,
          recentNotes: nextRecentNotes,
          displayNames: nextDisplayNames,
          noteContentsCache: nextNoteContentsCache,
        });
      } catch (error) {
        set({ error: error instanceof Error ? error.message : 'Failed to rename note' });
      }
    },

    renameFolder: async (path: string, newName: string) => {
      const {
        notesPath,
        rootFolder,
        currentNote,
        openTabs,
        starredEntries,
        fileTreeSortMode,
        noteMetadata,
        noteContentsCache,
        recentNotes,
        displayNames,
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
        emitNotesExternalPathRename({ notesPath, oldPath: path, newPath });

        const result = await processFolderRename(notesPath, path, fileName, {
          rootFolder,
          currentNote,
          openTabs,
          starredEntries,
          noteMetadata,
        });
        const { nextRecentNotes, nextDisplayNames, nextNoteContentsCache } = applyPathRenameState({
          oldPath: path,
          newPath,
          recentNotes,
          displayNames,
          noteContentsCache,
        });

        if (!rootFolder) {
          set({
            starredEntries: result.updatedStarredEntries,
            starredFolders: result.updatedStarredFolders,
            starredNotes: result.updatedStarredNotes,
            noteMetadata: result.updatedMetadata ?? noteMetadata,
            recentNotes: nextRecentNotes,
            displayNames: nextDisplayNames,
            noteContentsCache: nextNoteContentsCache,
          });
          return;
        }

        const nextRootFolder = buildSortedRootFolder(
          rootFolder,
          updateFolderNode(rootFolder.children, path, fileName, newPath),
          fileTreeSortMode,
          result.updatedMetadata ?? noteMetadata,
        );

        set({
          starredEntries: result.updatedStarredEntries,
          starredFolders: result.updatedStarredFolders,
          starredNotes: result.updatedStarredNotes,
          noteMetadata: result.updatedMetadata ?? noteMetadata,
          recentNotes: nextRecentNotes,
          displayNames: nextDisplayNames,
          noteContentsCache: nextNoteContentsCache,
          rootFolder: nextRootFolder,
          openTabs: result.updatedTabs,
          currentNote: result.updatedCurrentNote,
        });

        persistWorkspaceSnapshot(notesPath, {
          rootFolder: nextRootFolder,
          currentNotePath: result.updatedCurrentNote?.path ?? null,
          fileTreeSortMode,
        });
      } catch (error) {
        set({ error: error instanceof Error ? error.message : 'Failed to rename folder' });
      }
    },

    moveItem: async (sourcePath: string, targetFolderPath: string) => {
      const {
        notesPath,
        rootFolder,
        currentNote,
        openTabs,
        starredEntries,
        fileTreeSortMode,
        noteMetadata,
        noteContentsCache,
        recentNotes,
        displayNames,
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
        const { nextRecentNotes, nextDisplayNames, nextNoteContentsCache } = applyPathRenameState({
          oldPath: result.sourcePath,
          newPath: result.newPath,
          recentNotes,
          displayNames,
          noteContentsCache,
        });
        const nextRootFolder = buildSortedRootFolder(
          rootFolder,
          result.newChildren,
          fileTreeSortMode,
          result.updatedMetadata ?? noteMetadata,
        );

        set({
          starredEntries: result.updatedStarredEntries,
          starredNotes: result.updatedStarredNotes,
          starredFolders: result.updatedStarredFolders,
          noteMetadata: result.updatedMetadata ?? noteMetadata,
          openTabs: result.updatedTabs,
          currentNote: result.nextCurrentNote,
          recentNotes: nextRecentNotes,
          displayNames: nextDisplayNames,
          noteContentsCache: nextNoteContentsCache,
          ...(nextRootFolder ? { rootFolder: nextRootFolder } : {}),
        });

        persistWorkspaceSnapshot(notesPath, {
          rootFolder: nextRootFolder ?? rootFolder,
          currentNotePath: result.nextCurrentNote?.path ?? null,
          fileTreeSortMode,
        });
      } catch (error) {
        set({ error: error instanceof Error ? error.message : 'Failed to move item' });
      }
    },
  };
}
