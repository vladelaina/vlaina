import { getNotesRootStarredPaths, remapStarredEntriesForNotesRoot, saveStarredRegistry } from '../starred';
import {
  cancelPendingSystemTrash,
  isPendingSystemTrashCommitting,
  schedulePendingSystemTrash,
} from '../utils/fs/trashOperations';
import { createEmptyMetadataFile, remapMetadataEntries, setNoteEntry } from '../storage';
import { shouldRemoveForExternalDeletion } from '../document/externalPathSync';
import { saveNoteDocument } from '../document/noteDocumentPersistence';
import { setNoteTabDirtyState } from '../document/noteTabState';
import { setCachedNoteContent } from '../document/noteContentCache';
import type { FileOperationNextAction } from '../utils/fs/operationTypes';
import type { FileSystemSliceGet, FileSystemSliceSet } from './fileSystemSliceContracts';

export function isActiveNotesPath(get: FileSystemSliceGet, notesPath: string) {
  return get().notesPath === notesPath;
}

export function resolveNextOpenPath(
  matchesDeletedTarget: boolean,
  nextAction: FileOperationNextAction,
) {
  return matchesDeletedTarget && nextAction?.type === 'open' ? nextAction.path : null;
}

export function shouldPreserveDirtyDeletedCurrentNote(
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

export function getDirtyDeletedOpenTabPaths(
  state: ReturnType<FileSystemSliceGet>,
  deletedPath: string,
) {
  return state.openTabs
    .filter((tab) => tab.isDirty && shouldRemoveForExternalDeletion(tab.path, deletedPath))
    .map((tab) => tab.path);
}

export function getStarredStateAfterDeletion(
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

export function getMetadataAfterDeletion(
  noteMetadata: ReturnType<FileSystemSliceGet>['noteMetadata'],
  deletedPath: string,
) {
  return remapMetadataEntries(noteMetadata, (metadataPath) =>
    shouldRemoveForExternalDeletion(metadataPath, deletedPath) ? null : metadataPath,
  );
}

export async function saveDirtyOpenTabsBeforeDeletion(
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

export function schedulePendingDeleteCommit(
  set: FileSystemSliceSet,
  get: FileSystemSliceGet,
  pendingDeletedItem: ReturnType<FileSystemSliceGet>['pendingDeletedItems'][number],
) {
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
}

export function cancelPendingDeleteCommit(pendingDeletedItemId: string) {
  return cancelPendingSystemTrash(pendingDeletedItemId);
}

export function isPendingDeleteCommitInProgress(pendingDeletedItemId: string) {
  return isPendingSystemTrashCommitting(pendingDeletedItemId);
}
