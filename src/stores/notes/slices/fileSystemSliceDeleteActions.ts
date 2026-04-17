import { buildSortedRootFolder } from '../utils/fs/rootFolderState';
import { deleteFolderImpl, deleteNoteImpl } from '../utils/fs/deleteOperations';
import { persistWorkspaceSnapshot } from '../workspacePersistence';
import {
  applyPathDeletionState,
  isPathWithinFolder,
} from './fileSystemSliceHelpers';
import type { FileOperationNextAction } from '../utils/fs/operationTypes';
import type { FileSystemSlice, FileSystemSliceGet, FileSystemSliceSet } from './fileSystemSliceContracts';

function resolveNextOpenPath(
  matchesDeletedTarget: boolean,
  nextAction: FileOperationNextAction,
) {
  return matchesDeletedTarget && nextAction?.type === 'open' ? nextAction.path : null;
}

export function createFileSystemDeleteActions(
  set: FileSystemSliceSet,
  get: FileSystemSliceGet,
): Pick<FileSystemSlice, 'deleteNote' | 'deleteFolder'> {
  return {
    deleteNote: async (path: string) => {
      const {
        notesPath,
        rootFolder,
        currentNote,
        openTabs,
        recentNotes,
        starredEntries,
        fileTreeSortMode,
        noteMetadata,
        noteContentsCache,
        displayNames,
      } = get();

      try {
        const result = await deleteNoteImpl(notesPath, path, {
          rootFolder,
          currentNote,
          openTabs,
          starredEntries,
          noteMetadata,
        });
        const { nextRecentNotes, nextDisplayNames, nextNoteContentsCache } = applyPathDeletionState({
          path,
          recentNotes,
          displayNames,
          noteContentsCache,
        });
        const nextOpenPath = resolveNextOpenPath(currentNote?.path === path, result.nextAction);
        const nextRootFolder = buildSortedRootFolder(
          rootFolder,
          result.newChildren,
          fileTreeSortMode,
          result.updatedMetadata ?? noteMetadata,
        );

        set({
          openTabs: result.updatedTabs,
          starredEntries: result.updatedStarredEntries,
          starredNotes: result.updatedStarredNotes,
          starredFolders: result.updatedStarredFolders,
          recentNotes: nextRecentNotes,
          displayNames: nextDisplayNames,
          noteMetadata: result.updatedMetadata ?? noteMetadata,
          noteContentsCache: nextNoteContentsCache,
          rootFolder: nextRootFolder ?? rootFolder,
          ...(currentNote?.path === path && !nextOpenPath ? { currentNote: null, isDirty: false } : {}),
        });

        persistWorkspaceSnapshot(notesPath, {
          rootFolder: nextRootFolder ?? rootFolder,
          currentNotePath: nextOpenPath ?? (currentNote?.path === path ? null : currentNote?.path ?? null),
          fileTreeSortMode,
        });

        if (nextOpenPath) {
          await get().openNote(nextOpenPath);
        }
      } catch (error) {
        set({ error: error instanceof Error ? error.message : 'Failed to delete note' });
      }
    },

    deleteFolder: async (path: string) => {
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
        const result = await deleteFolderImpl(notesPath, path, {
          rootFolder,
          currentNote,
          openTabs,
          starredEntries,
          noteMetadata,
        });
        const { nextRecentNotes, nextDisplayNames, nextNoteContentsCache } = applyPathDeletionState({
          path,
          recentNotes,
          displayNames,
          noteContentsCache,
        });
        const isDeletingCurrentNote = Boolean(currentNote && isPathWithinFolder(currentNote.path, path));
        const nextOpenPath = resolveNextOpenPath(isDeletingCurrentNote, result.nextAction);
        const nextRootFolder = buildSortedRootFolder(
          rootFolder,
          result.newChildren,
          fileTreeSortMode,
          result.updatedMetadata ?? noteMetadata,
        );

        set({
          starredEntries: result.updatedStarredEntries,
          starredFolders: result.updatedStarredFolders,
          starredNotes: result.updatedStarredNotes,
          openTabs: result.updatedTabs,
          recentNotes: nextRecentNotes,
          displayNames: nextDisplayNames,
          noteMetadata: result.updatedMetadata ?? noteMetadata,
          noteContentsCache: nextNoteContentsCache,
          rootFolder: nextRootFolder ?? rootFolder,
          ...(isDeletingCurrentNote && !nextOpenPath ? { currentNote: null, isDirty: false } : {}),
        });

        persistWorkspaceSnapshot(notesPath, {
          rootFolder: nextRootFolder ?? rootFolder,
          currentNotePath: nextOpenPath ?? (isDeletingCurrentNote ? null : currentNote?.path ?? null),
          fileTreeSortMode,
        });

        if (nextOpenPath) {
          await get().openNote(nextOpenPath);
        }
      } catch (error) {
        set({ error: error instanceof Error ? error.message : 'Failed to delete folder' });
      }
    },
  };
}
