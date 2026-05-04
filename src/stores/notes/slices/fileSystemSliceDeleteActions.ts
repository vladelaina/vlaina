import { addNodeToTree } from '../fileTreeUtils';
import { saveStarredRegistry } from '../starred';
import { buildSortedRootFolder } from '../utils/fs/rootFolderState';
import { deleteFolderImpl, deleteNoteImpl } from '../utils/fs/deleteOperations';
import { restoreNoteItemFromRecoverableLocation } from '../utils/fs/trashOperations';
import { persistWorkspaceSnapshot } from '../workspacePersistence';
import {
  collectDeletedMetadata,
  collectDeletedStarredEntries,
  createRestoredTreeNode,
  getParentPath,
  restoreDeletedMetadata,
  restoreDeletedStarredEntries,
} from './fileSystemSliceRestoreHelpers';
import {
  applyPathDeletionState,
  isPathWithinFolder,
} from './fileSystemSliceHelpers';
import type { FileOperationNextAction } from '../utils/fs/operationTypes';
import type { FileSystemSlice, FileSystemSliceGet, FileSystemSliceSet } from './fileSystemSliceContracts';

function isActiveNotesPath(get: FileSystemSliceGet, notesPath: string) {
  return get().notesPath === notesPath;
}

function resolveNextOpenPath(
  matchesDeletedTarget: boolean,
  nextAction: FileOperationNextAction,
) {
  return matchesDeletedTarget && nextAction?.type === 'open' ? nextAction.path : null;
}

export function createFileSystemDeleteActions(
  set: FileSystemSliceSet,
  get: FileSystemSliceGet,
): Pick<FileSystemSlice, 'deleteNote' | 'deleteFolder' | 'restoreLastDeletedItem'> {
  return {
    deleteNote: async (path: string) => {
      let operationNotesPath = get().notesPath;
      try {
        if (get().currentNote?.path === path && get().isDirty) {
          await get().saveNote();
          if (get().isDirty) {
            throw new Error('Failed to save current note before deleting it');
          }
        }

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
        operationNotesPath = notesPath;

        const result = await deleteNoteImpl(notesPath, path, {
          rootFolder,
          currentNote,
          openTabs,
          starredEntries,
          noteMetadata,
        });
        if (!isActiveNotesPath(get, notesPath)) {
          return;
        }
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
          pendingDeletedItems: [
            ...get().pendingDeletedItems,
            {
              ...result.recoverableDelete,
              previousCurrentNote: currentNote,
              previousIsDirty: get().isDirty,
              deletedStarredEntries: collectDeletedStarredEntries(starredEntries, path, 'file'),
              deletedMetadata: collectDeletedMetadata(noteMetadata, path, 'file'),
            },
          ],
          ...(currentNote?.path === path && !nextOpenPath ? { currentNote: null, isDirty: false } : {}),
        });

        persistWorkspaceSnapshot(notesPath, {
          rootFolder: nextRootFolder ?? rootFolder,
          currentNotePath: nextOpenPath ?? (currentNote?.path === path ? null : currentNote?.path ?? null),
          fileTreeSortMode,
        });

        if (nextOpenPath) {
          if (!isActiveNotesPath(get, notesPath)) {
            return;
          }
          await get().openNote(nextOpenPath);
        }
      } catch (error) {
        if (operationNotesPath && !isActiveNotesPath(get, operationNotesPath)) {
          return;
        }
        set({ error: error instanceof Error ? error.message : 'Failed to delete note' });
      }
    },

    deleteFolder: async (path: string) => {
      let operationNotesPath = get().notesPath;
      try {
        const initialCurrentNote = get().currentNote;
        if (initialCurrentNote && isPathWithinFolder(initialCurrentNote.path, path) && get().isDirty) {
          await get().saveNote();
          if (get().isDirty) {
            throw new Error('Failed to save current note before deleting its folder');
          }
        }

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
        operationNotesPath = notesPath;

        const result = await deleteFolderImpl(notesPath, path, {
          rootFolder,
          currentNote,
          openTabs,
          starredEntries,
          noteMetadata,
        });
        if (!isActiveNotesPath(get, notesPath)) {
          return;
        }
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
          pendingDeletedItems: [
            ...get().pendingDeletedItems,
            {
              ...result.recoverableDelete,
              previousCurrentNote: currentNote,
              previousIsDirty: get().isDirty,
              deletedStarredEntries: collectDeletedStarredEntries(starredEntries, path, 'folder'),
              deletedMetadata: collectDeletedMetadata(noteMetadata, path, 'folder'),
            },
          ],
          ...(isDeletingCurrentNote && !nextOpenPath ? { currentNote: null, isDirty: false } : {}),
        });

        persistWorkspaceSnapshot(notesPath, {
          rootFolder: nextRootFolder ?? rootFolder,
          currentNotePath: nextOpenPath ?? (isDeletingCurrentNote ? null : currentNote?.path ?? null),
          fileTreeSortMode,
        });

        if (nextOpenPath) {
          if (!isActiveNotesPath(get, notesPath)) {
            return;
          }
          await get().openNote(nextOpenPath);
        }
      } catch (error) {
        if (operationNotesPath && !isActiveNotesPath(get, operationNotesPath)) {
          return;
        }
        set({ error: error instanceof Error ? error.message : 'Failed to delete folder' });
      }
    },

    restoreLastDeletedItem: async () => {
      const { notesPath, pendingDeletedItems } = get();
      const pendingDeletedItem = pendingDeletedItems[pendingDeletedItems.length - 1];
      if (!pendingDeletedItem) {
        return null;
      }

      try {
        const result = await restoreNoteItemFromRecoverableLocation(notesPath, pendingDeletedItem);
        if (!isActiveNotesPath(get, notesPath)) {
          return result.restoredPath;
        }
        const restoredNode = await createRestoredTreeNode(
          notesPath,
          result.restoredPath,
          pendingDeletedItem.kind,
        );
        if (!isActiveNotesPath(get, notesPath)) {
          return result.restoredPath;
        }
        const {
          rootFolder,
          fileTreeSortMode,
          noteMetadata,
          currentNote,
          starredEntries,
        } = get();
        const restoredParentPath = getParentPath(result.restoredPath);
        const restoredMetadata = restoreDeletedMetadata({
          currentMetadata: noteMetadata,
          deletedMetadata: pendingDeletedItem.deletedMetadata,
          originalPath: pendingDeletedItem.originalPath,
          restoredPath: result.restoredPath,
        });
        const restoredStarred = restoreDeletedStarredEntries({
          currentEntries: starredEntries,
          deletedEntries: pendingDeletedItem.deletedStarredEntries,
          notesPath,
          originalPath: pendingDeletedItem.originalPath,
          restoredPath: result.restoredPath,
        });
        const nextRootFolder = rootFolder
          ? buildSortedRootFolder(
              rootFolder,
              addNodeToTree(rootFolder.children, restoredParentPath, restoredNode),
              fileTreeSortMode,
              restoredMetadata,
            )
          : null;

        set({
          pendingDeletedItems: get().pendingDeletedItems.filter((item) => item.id !== pendingDeletedItem.id),
          error: null,
          rootFolder: nextRootFolder ?? rootFolder,
          noteMetadata: restoredMetadata,
          starredEntries: restoredStarred.entries,
          starredNotes: restoredStarred.notes,
          starredFolders: restoredStarred.folders,
        });

        if (restoredStarred.changed) {
          void saveStarredRegistry(restoredStarred.entries);
        }

        if (!nextRootFolder) {
          if (!isActiveNotesPath(get, notesPath)) {
            return result.restoredPath;
          }
          await get().loadFileTree(true);
        } else {
          persistWorkspaceSnapshot(notesPath, {
            rootFolder: nextRootFolder,
            currentNotePath: currentNote?.path ?? null,
            fileTreeSortMode,
          });
        }

        if (pendingDeletedItem.kind === 'file') {
          if (!isActiveNotesPath(get, notesPath)) {
            return result.restoredPath;
          }
          await get().openNote(result.restoredPath);
        } else if (
          pendingDeletedItem.previousCurrentNote &&
          (pendingDeletedItem.previousCurrentNote.path === pendingDeletedItem.originalPath ||
            pendingDeletedItem.previousCurrentNote.path.startsWith(`${pendingDeletedItem.originalPath}/`))
        ) {
          const restoredCurrentPath = pendingDeletedItem.previousCurrentNote.path === pendingDeletedItem.originalPath
            ? result.restoredPath
            : `${result.restoredPath}${pendingDeletedItem.previousCurrentNote.path.slice(pendingDeletedItem.originalPath.length)}`;
          if (!isActiveNotesPath(get, notesPath)) {
            return result.restoredPath;
          }
          await get().openNote(restoredCurrentPath);
        }

        return result.restoredPath;
      } catch (error) {
        if (notesPath && !isActiveNotesPath(get, notesPath)) {
          return null;
        }
        set({ error: error instanceof Error ? error.message : 'Failed to restore deleted item' });
        return null;
      }
    },
  };
}
