import { removeNodeFromTree } from '../fileTreeUtils';
import { moveDesktopItemToTrash } from '@/lib/desktop/trash';
import { isImageFilename } from '@/lib/assets/core/naming';
import { revokeImageBlob } from '@/lib/assets/io/reader';
import { markExpectedExternalChange } from '../document/externalChangeRegistry';
import { assertNonInternalNotePath } from '../utils/fs/internalNotePaths';
import { resolveNotesRootRelativeFullPath } from '../utils/fs/notesRootPathContainment';
import { buildSortedRootFolder } from '../utils/fs/rootFolderState';
import { deleteFolderImpl } from '../utils/fs/deleteOperations';
import { persistWorkspaceSnapshot } from '../workspacePersistence';
import {
  collectDeletedMetadata,
  collectDeletedStarredEntries,
} from './fileSystemSliceRestoreHelpers';
import {
  applyPathDeletionState,
  isPathWithinFolder,
} from './fileSystemSliceHelpers';
import { flushCurrentPendingEditorMarkdown } from '../pendingEditorMarkdownFlusher';
import { setCachedNoteContent } from '../document/noteContentCache';
import { setNoteTabDirtyState } from '../document/noteTabState';
import { pruneNoteNavigationHistoryForExternalDeletion } from '../document/noteNavigationHistory';
import {
  pruneOpenTabsForExternalDeletion,
  shouldRemoveForExternalDeletion,
} from '../document/externalPathSync';
import type { FileSystemSlice, FileSystemSliceGet, FileSystemSliceSet } from './fileSystemSliceContracts';
import { createDeleteNoteAction } from './fileSystemSliceDeleteNoteAction';
import {
  getDirtyDeletedOpenTabPaths,
  getMetadataAfterDeletion,
  getStarredStateAfterDeletion,
  isActiveNotesPath,
  resolveNextOpenPath,
  saveDirtyOpenTabsBeforeDeletion,
  schedulePendingDeleteCommit,
  shouldPreserveDirtyDeletedCurrentNote,
} from './fileSystemSliceDeleteShared';
import { createRestoreLastDeletedItemAction } from './fileSystemSliceRestoreDeletedAction';

export function createFileSystemDeleteActions(
  set: FileSystemSliceSet,
  get: FileSystemSliceGet,
): Pick<FileSystemSlice, 'deleteNote' | 'deleteImage' | 'deleteFolder' | 'restoreLastDeletedItem'> {
  return {
    deleteNote: createDeleteNoteAction(set, get),

    deleteImage: async (path: string) => {
      const notesPath = get().notesPath;
      try {
        if (!isImageFilename(path)) {
          throw new Error('Only image files can be deleted with this action.');
        }
        const { relativePath, fullPath } = await resolveNotesRootRelativeFullPath(notesPath, path);
        assertNonInternalNotePath(relativePath);
        markExpectedExternalChange(fullPath);
        await moveDesktopItemToTrash(fullPath);
        if (!isActiveNotesPath(get, notesPath)) {
          return;
        }

        revokeImageBlob(fullPath);
        const state = get();
        const nextRootFolder = state.rootFolder
          ? buildSortedRootFolder(
              state.rootFolder,
              removeNodeFromTree(state.rootFolder.children, relativePath),
              state.fileTreeSortMode,
              state.noteMetadata,
            )
          : null;
        set({ rootFolder: nextRootFolder ?? state.rootFolder, error: null });
        persistWorkspaceSnapshot(notesPath, {
          rootFolder: nextRootFolder ?? state.rootFolder,
          currentNotePath: state.currentNote?.path ?? null,
          fileTreeSortMode: state.fileTreeSortMode,
        });
      } catch (error) {
        if (notesPath && !isActiveNotesPath(get, notesPath)) {
          return;
        }
        set({ error: error instanceof Error ? error.message : 'Failed to delete image' });
      }
    },

    deleteFolder: async (path: string) => {
      let operationNotesPath = get().notesPath;
      try {
        flushCurrentPendingEditorMarkdown();
        const initialCurrentNote = get().currentNote;
        if (initialCurrentNote && isPathWithinFolder(initialCurrentNote.path, path) && get().isDirty) {
          await get().saveNote();
          if (get().isDirty) {
            throw new Error('Failed to save current note before deleting its folder');
          }
        }
        const dirtyDeletedPaths = getDirtyDeletedOpenTabPaths(get(), path);
        if (dirtyDeletedPaths.length > 0) {
          if (!await saveDirtyOpenTabsBeforeDeletion(
            set,
            get,
            dirtyDeletedPaths,
            'Failed to save dirty notes before deleting their folder',
          )) {
            return;
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
        const latestState = get();
        const deletedPath = result.trashedItem.originalPath;
        const {
          nextRecentNotes,
          nextDisplayNames,
          nextNoteContentsCache: prunedNoteContentsCache,
        } = applyPathDeletionState({
          path: deletedPath,
          recentNotes: latestState.recentNotes,
          displayNames: latestState.displayNames,
          noteContentsCache: latestState.noteContentsCache,
        });
        const latestCurrentNote = latestState.currentNote;
        const isDeletingCurrentNote = Boolean(
          latestCurrentNote && shouldRemoveForExternalDeletion(latestCurrentNote.path, deletedPath),
        );
        const preserveDirtyDeletedCurrentNote = shouldPreserveDirtyDeletedCurrentNote(
          latestCurrentNote,
          currentNote,
          latestState.isDirty,
          deletedPath,
        );
        const nextOpenPath = preserveDirtyDeletedCurrentNote
          ? null
          : resolveNextOpenPath(isDeletingCurrentNote, result.nextAction);
        const latestRootFolder = latestState.rootFolder ?? rootFolder;
        const deletedStarredEntries = collectDeletedStarredEntries(
          latestState.starredEntries,
          deletedPath,
          'folder',
        );
        const deletedMetadata = collectDeletedMetadata(latestState.noteMetadata, deletedPath, 'folder');
        const latestMetadata = getMetadataAfterDeletion(latestState.noteMetadata, deletedPath);
        const nextStarred = getStarredStateAfterDeletion(
          latestState.starredEntries,
          notesPath,
          deletedPath,
          'folder',
        );
        const latestSortMode = latestState.fileTreeSortMode ?? fileTreeSortMode;
        const nextRootFolder = buildSortedRootFolder(
          latestRootFolder,
          latestRootFolder ? removeNodeFromTree(latestRootFolder.children, deletedPath) : result.newChildren,
          latestSortMode,
          latestMetadata,
        );
        const nextOpenTabs = preserveDirtyDeletedCurrentNote && latestCurrentNote
          ? setNoteTabDirtyState(
              latestState.openTabs.filter(
                (tab) =>
                  !shouldRemoveForExternalDeletion(tab.path, deletedPath) || tab.path === latestCurrentNote.path
              ),
              latestCurrentNote.path,
              true,
            )
          : pruneOpenTabsForExternalDeletion(latestState.openTabs, deletedPath);
        const nextNoteContentsCache = preserveDirtyDeletedCurrentNote && latestCurrentNote
          ? setCachedNoteContent(
              prunedNoteContentsCache,
              latestCurrentNote.path,
              latestCurrentNote.content,
              latestState.noteContentsCache.get(latestCurrentNote.path)?.modifiedAt ?? null,
            )
          : prunedNoteContentsCache;
        const pendingDeletedItem = {
          ...result.trashedItem,
          previousCurrentNote: currentNote,
          previousIsDirty: latestState.isDirty,
          deletedStarredEntries,
          deletedMetadata,
        };

        set({
          starredEntries: nextStarred.entries,
          starredFolders: nextStarred.folders,
          starredNotes: nextStarred.notes,
          openTabs: nextOpenTabs,
          recentNotes: nextRecentNotes,
          displayNames: nextDisplayNames,
          noteMetadata: latestMetadata,
          noteContentsCache: nextNoteContentsCache,
          rootFolder: nextRootFolder ?? latestRootFolder,
          ...pruneNoteNavigationHistoryForExternalDeletion(
            latestState.noteNavigationHistory,
            latestState.noteNavigationHistoryIndex,
            deletedPath,
            preserveDirtyDeletedCurrentNote ? latestCurrentNote?.path ?? null : null,
          ),
          pendingDeletedItems: [
            ...latestState.pendingDeletedItems,
            pendingDeletedItem,
          ],
          ...(preserveDirtyDeletedCurrentNote
            ? {
                currentNote: latestCurrentNote,
                isDirty: true,
                error: 'Current note changed while deletion was in progress. Its latest content is preserved; save to restore it.',
              }
            : isDeletingCurrentNote && !nextOpenPath
              ? { currentNote: null, isDirty: false }
              : {}),
        });
        schedulePendingDeleteCommit(set, get, pendingDeletedItem);

        persistWorkspaceSnapshot(notesPath, {
          rootFolder: nextRootFolder ?? latestRootFolder,
          currentNotePath: preserveDirtyDeletedCurrentNote
            ? latestCurrentNote?.path ?? null
            : nextOpenPath ?? (isDeletingCurrentNote ? null : latestCurrentNote?.path ?? null),
          fileTreeSortMode: latestSortMode,
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

    restoreLastDeletedItem: createRestoreLastDeletedItemAction(set, get),
  };
}
