import { addNodeToTree, removeNodeFromTree } from '../fileTreeUtils';
import { getNotesRootStarredPaths, remapStarredEntriesForNotesRoot, saveStarredRegistry } from '../starred';
import { buildSortedRootFolder } from '../utils/fs/rootFolderState';
import { deleteFolderImpl, deleteNoteImpl } from '../utils/fs/deleteOperations';
import {
  cancelPendingSystemTrash,
  isPendingSystemTrashCommitting,
  restoreNoteItemFromPendingTrash,
  schedulePendingSystemTrash,
} from '../utils/fs/trashOperations';
import { persistWorkspaceSnapshot } from '../workspacePersistence';
import { createEmptyMetadataFile, remapMetadataEntries, setNoteEntry } from '../storage';
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
import { flushCurrentPendingEditorMarkdown } from '../pendingEditorMarkdownFlusher';
import { setCachedNoteContent } from '../document/noteContentCache';
import { saveNoteDocument } from '../document/noteDocumentPersistence';
import { setNoteTabDirtyState } from '../document/noteTabState';
import { pruneNoteNavigationHistoryForExternalDeletion } from '../document/noteNavigationHistory';
import {
  pruneOpenTabsForExternalDeletion,
  shouldRemoveForExternalDeletion,
} from '../document/externalPathSync';
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

function shouldPreserveDirtyDeletedCurrentNote(
  latestCurrentNote: ReturnType<FileSystemSliceGet>['currentNote'],
  originalCurrentNote: ReturnType<FileSystemSliceGet>['currentNote'],
  isDirty: boolean,
  deletedPath: string,
) {
  return Boolean(
    latestCurrentNote &&
      isDirty &&
      shouldRemoveForExternalDeletion(latestCurrentNote.path, deletedPath) &&
      latestCurrentNote.content !== originalCurrentNote?.content
  );
}

function getOpenTabContentForPath(
  state: ReturnType<FileSystemSliceGet>,
  path: string,
): string | null {
  if (state.currentNote?.path === path) {
    return state.currentNote.content;
  }

  return state.noteContentsCache.get(path)?.content ?? null;
}

function getDirtyDeletedOpenTabPaths(
  state: ReturnType<FileSystemSliceGet>,
  deletedPath: string,
) {
  return state.openTabs
    .filter((tab) => tab.isDirty && shouldRemoveForExternalDeletion(tab.path, deletedPath))
    .map((tab) => tab.path);
}

function getStarredStateAfterDeletion(
  starredEntries: ReturnType<FileSystemSliceGet>['starredEntries'],
  notesPath: string,
  deletedPath: string,
  kind: 'file' | 'folder',
) {
  const starredResult = remapStarredEntriesForNotesRoot(starredEntries, notesPath, (relativePath, entryKind) => {
    if (kind === 'file') {
      return entryKind === 'note' && relativePath === deletedPath ? null : relativePath;
    }
    return shouldRemoveForExternalDeletion(relativePath, deletedPath) ? null : relativePath;
  });
  if (starredResult.changed) {
    void Promise.resolve(saveStarredRegistry(starredResult.entries)).catch(() => undefined);
  }

  const starredPaths = getNotesRootStarredPaths(starredResult.entries, notesPath);
  return {
    entries: starredResult.entries,
    notes: starredPaths.notes,
    folders: starredPaths.folders,
  };
}

function getMetadataAfterDeletion(
  noteMetadata: ReturnType<FileSystemSliceGet>['noteMetadata'],
  deletedPath: string,
) {
  return remapMetadataEntries(noteMetadata, (metadataPath) =>
    shouldRemoveForExternalDeletion(metadataPath, deletedPath) ? null : metadataPath,
  );
}

async function saveDirtyOpenTabsBeforeDeletion(
  set: FileSystemSliceSet,
  get: FileSystemSliceGet,
  dirtyDeletedPaths: string[],
  errorMessage: string,
) {
  const notesPath = get().notesPath;
  for (const dirtyPath of dirtyDeletedPaths) {
    const stateAtSaveStart = get();
    if (stateAtSaveStart.notesPath !== notesPath) {
      return false;
    }
    if (!stateAtSaveStart.openTabs.some((tab) => tab.path === dirtyPath && tab.isDirty)) {
      continue;
    }

    const contentAtSaveStart = getOpenTabContentForPath(stateAtSaveStart, dirtyPath);
    if (contentAtSaveStart == null) {
      throw new Error(errorMessage);
    }

    const { content, metadata, modifiedAt, size } = await saveNoteDocument({
      notesPath,
      currentNote: { path: dirtyPath, content: contentAtSaveStart },
      cache: stateAtSaveStart.noteContentsCache,
    });

    const latestState = get();
    if (latestState.notesPath !== notesPath) {
      return false;
    }
    const latestContent = getOpenTabContentForPath(latestState, dirtyPath);
    if (latestContent != null && latestContent !== contentAtSaveStart) {
      throw new Error(errorMessage);
    }

    const nextMetadata = setNoteEntry(
      latestState.noteMetadata ?? createEmptyMetadataFile(),
      dirtyPath,
      metadata,
    );
    set({
      currentNote: latestState.currentNote?.path === dirtyPath
        ? { path: dirtyPath, content }
        : latestState.currentNote,
      isDirty: latestState.currentNote?.path === dirtyPath ? false : latestState.isDirty,
      openTabs: setNoteTabDirtyState(latestState.openTabs, dirtyPath, false),
      noteContentsCache: setCachedNoteContent(
        latestState.noteContentsCache,
        dirtyPath,
        content,
        modifiedAt,
        { updateBaseline: true, size },
      ),
      noteMetadata: nextMetadata,
      error: null,
    });
  }

  return true;
}

export function createFileSystemDeleteActions(
  set: FileSystemSliceSet,
  get: FileSystemSliceGet,
): Pick<FileSystemSlice, 'deleteNote' | 'deleteFolder' | 'restoreLastDeletedItem'> {
  const schedulePendingDeleteCommit = (
    pendingDeletedItem: ReturnType<FileSystemSliceGet>['pendingDeletedItems'][number],
  ) => {
    schedulePendingSystemTrash(
      pendingDeletedItem,
      async (committedItem) => {
        const latestState = get();
        if (!latestState.pendingDeletedItems.some((item) => item.id === committedItem.id)) {
          return;
        }
        set({
          pendingDeletedItems: latestState.pendingDeletedItems.filter((item) => item.id !== committedItem.id),
        });
      },
      async (failedItem, error) => {
        const latestState = get();
        if (!latestState.pendingDeletedItems.some((item) => item.id === failedItem.id)) {
          return;
        }
        set({ error: error instanceof Error ? error.message : 'Failed to move deleted item to system trash' });
      },
    );
  };

  return {
    deleteNote: async (path: string) => {
      let operationNotesPath = get().notesPath;
      try {
        flushCurrentPendingEditorMarkdown();
        if (get().draftNotes[path]) {
          get().discardDraftNote(path);
          return;
        }

        if (get().currentNote?.path === path && get().isDirty) {
          await get().saveNote();
          if (get().isDirty) {
            throw new Error('Failed to save current note before deleting it');
          }
        }
        const dirtyDeletedPaths = getDirtyDeletedOpenTabPaths(get(), path);
        if (dirtyDeletedPaths.length > 0) {
          if (!await saveDirtyOpenTabsBeforeDeletion(
            set,
            get,
            dirtyDeletedPaths,
            'Failed to save dirty note before deleting it',
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
          latestCurrentNote && shouldRemoveForExternalDeletion(latestCurrentNote.path, deletedPath)
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
          'file',
        );
        const deletedMetadata = collectDeletedMetadata(latestState.noteMetadata, deletedPath, 'file');
        const latestMetadata = getMetadataAfterDeletion(latestState.noteMetadata, deletedPath);
        const nextStarred = getStarredStateAfterDeletion(
          latestState.starredEntries,
          notesPath,
          deletedPath,
          'file',
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
          openTabs: nextOpenTabs,
          starredEntries: nextStarred.entries,
          starredNotes: nextStarred.notes,
          starredFolders: nextStarred.folders,
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
        schedulePendingDeleteCommit(pendingDeletedItem);

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
        set({ error: error instanceof Error ? error.message : 'Failed to delete note' });
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
        schedulePendingDeleteCommit(pendingDeletedItem);

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

    restoreLastDeletedItem: async () => {
      const { notesPath, pendingDeletedItems } = get();
      const pendingDeletedItem = pendingDeletedItems[pendingDeletedItems.length - 1];
      if (!pendingDeletedItem) {
        return null;
      }

      const cancelledPendingCommit = cancelPendingSystemTrash(pendingDeletedItem.id);
      if (!cancelledPendingCommit && isPendingSystemTrashCommitting(pendingDeletedItem.id)) {
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
        if (!isPendingSystemTrashCommitting(pendingDeletedItem.id)) {
          schedulePendingDeleteCommit(pendingDeletedItem);
        }
        set({ error: error instanceof Error ? error.message : 'Failed to restore deleted item' });
        return null;
      }
    },
  };
}
