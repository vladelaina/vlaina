import { addNodeToTree } from '../fileTreeUtils';
import { saveStarredRegistry } from '../starred';
import { buildSortedRootFolder } from '../utils/fs/rootFolderState';
import { restoreNoteItemFromPendingTrash } from '../utils/fs/trashOperations';
import { persistWorkspaceSnapshot } from '../workspacePersistence';
import {
  createRestoredTreeNode,
  getParentPath,
  restoreDeletedMetadata,
  restoreDeletedStarredEntries,
} from './fileSystemSliceRestoreHelpers';
import type { FileSystemSliceGet, FileSystemSliceSet } from './fileSystemSliceContracts';
import {
  cancelPendingDeleteCommit,
  isActiveNotesPath,
  isPendingDeleteCommitInProgress,
  schedulePendingDeleteCommit,
} from './fileSystemSliceDeleteShared';

export function createRestoreLastDeletedItemAction(
  set: FileSystemSliceSet,
  get: FileSystemSliceGet,
) {
  return async () => {
    const { notesPath, pendingDeletedItems } = get();
    const pendingDeletedItem = pendingDeletedItems[pendingDeletedItems.length - 1];
    if (!pendingDeletedItem) {
      return null;
    }

    const cancelledPendingCommit = cancelPendingDeleteCommit(pendingDeletedItem.id);
    if (!cancelledPendingCommit && isPendingDeleteCommitInProgress(pendingDeletedItem.id)) {
      set({ error: 'Deleted item is already moving to system trash.' });
      return null;
    }

    try {
      const result = await restoreNoteItemFromPendingTrash(notesPath, pendingDeletedItem);
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
        void Promise.resolve(saveStarredRegistry(restoredStarred.entries)).catch(() => undefined);
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
      if (!isPendingDeleteCommitInProgress(pendingDeletedItem.id)) {
        schedulePendingDeleteCommit(set, get, pendingDeletedItem);
      }
      set({ error: error instanceof Error ? error.message : 'Failed to restore deleted item' });
      return null;
    }
  };
}
