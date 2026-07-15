import { getNoteTitleFromPath } from '@/lib/notes/displayName';
import {
  updateFileNodePath,
} from '../fileTreeUtils';
import { renameNoteImpl } from '../utils/fs/renameOperations';
import { buildSortedRootFolder } from '../utils/fs/rootFolderState';
import {
  remapCurrentNoteForExternalRename,
  remapOpenTabsForExternalRename,
} from '../document/externalPathSync';
import { remapNoteNavigationHistoryForExternalRename } from '../document/noteNavigationHistory';
import { persistWorkspaceSnapshot } from '../workspacePersistence';
import { applyPathRenameState } from './fileSystemSliceHelpers';
import { flushCurrentPendingEditorMarkdown } from '../pendingEditorMarkdownFlusher';
import { renameAbsoluteNoteAction } from './fileSystemSliceAbsoluteRenameAction';
import { renameFolderAction, moveItemAction } from './fileSystemSliceFolderMoveActions';
import {
  isActiveNotesPath,
  remapMetadataForRename,
  remapStarredForNoteRename,
} from './fileSystemSliceRenameShared';
import type { FileSystemSlice, FileSystemSliceGet, FileSystemSliceSet } from './fileSystemSliceContracts';
import { renameImageAction } from './fileSystemSliceRenameImageAction';

export function createFileSystemRenameActions(
  set: FileSystemSliceSet,
  get: FileSystemSliceGet,
): Pick<FileSystemSlice, 'renameNote' | 'renameImage' | 'renameAbsoluteNote' | 'renameFolder' | 'moveItem'> {
  return {
    renameImage: (path: string, newName: string) => renameImageAction(set, get, path, newName),

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

    renameAbsoluteNote: (path: string, newName: string) =>
      renameAbsoluteNoteAction(set, get, path, newName),

    renameFolder: (path: string, newName: string) =>
      renameFolderAction(set, get, path, newName),

    moveItem: (sourcePath: string, targetFolderPath: string) =>
      moveItemAction(set, get, sourcePath, targetFolderPath),
  };
}
