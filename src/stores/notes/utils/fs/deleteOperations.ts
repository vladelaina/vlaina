import { getVaultStarredPaths, remapStarredEntriesForVault, saveStarredRegistry } from '../../starred';
import { removeNodeFromTree } from '../../fileTreeUtils';
import { markExpectedExternalChange } from '../../document/externalChangeRegistry';
import { remapMetadataEntries } from '../../storage';
import { deleteNoteItemToRecoverableLocation } from './trashOperations';
import { resolveVaultRelativeFullPath } from './vaultPathContainment';
import type {
  DeleteOperationResult,
  FileOperationContext,
  FileOperationNextAction,
  NoteTabState,
} from './operationTypes';

export async function deleteNoteImpl(
  notesPath: string,
  path: string,
  currentStore: FileOperationContext,
): Promise<DeleteOperationResult> {
  const { relativePath: safePath, fullPath } = await resolveVaultRelativeFullPath(notesPath, path);
  markExpectedExternalChange(fullPath);
  const recoverableDelete = await deleteNoteItemToRecoverableLocation(notesPath, safePath, 'file');

  const { openTabs, starredEntries, currentNote, rootFolder, noteMetadata } = currentStore;

  const updatedTabs = openTabs.filter((tab) => tab.path !== safePath);
  const starredResult = remapStarredEntriesForVault(starredEntries, notesPath, (relativePath, kind) => {
    if (kind !== 'note') {
      return relativePath;
    }
    return relativePath === safePath ? null : relativePath;
  });
  const starredPaths = getVaultStarredPaths(starredResult.entries, notesPath);
  if (starredResult.changed) {
    void saveStarredRegistry(starredResult.entries);
  }

  const newChildren = rootFolder ? removeNodeFromTree(rootFolder.children, safePath) : [];
  let nextAction: FileOperationNextAction = null;

  if (currentNote?.path === safePath) {
    const lastTab = updatedTabs[updatedTabs.length - 1] as NoteTabState | undefined;
    if (lastTab) {
      nextAction = { type: 'open', path: lastTab.path };
    }
  }

  const updatedMetadata = remapMetadataEntries(noteMetadata ?? null, (relativePath) =>
    relativePath === safePath ? null : relativePath,
  );

  return {
    updatedTabs,
    updatedStarredEntries: starredResult.entries,
    updatedStarredNotes: starredPaths.notes,
    updatedStarredFolders: starredPaths.folders,
    nextAction,
    updatedMetadata,
    newChildren,
    recoverableDelete,
  };
}

export async function deleteFolderImpl(
  notesPath: string,
  path: string,
  currentStore: FileOperationContext,
): Promise<DeleteOperationResult> {
  const { relativePath: safePath, fullPath } = await resolveVaultRelativeFullPath(notesPath, path);
  markExpectedExternalChange(fullPath, true);
  const recoverableDelete = await deleteNoteItemToRecoverableLocation(notesPath, safePath, 'folder');

  const { openTabs, starredEntries, currentNote, rootFolder, noteMetadata } = currentStore;

  const starredResult = remapStarredEntriesForVault(starredEntries, notesPath, (relativePath) => {
    if (relativePath === safePath || relativePath.startsWith(safePath + '/')) {
      return null;
    }
    return relativePath;
  });
  const starredPaths = getVaultStarredPaths(starredResult.entries, notesPath);
  if (starredResult.changed) {
    void saveStarredRegistry(starredResult.entries);
  }

  const updatedTabs = openTabs.filter((tab) => !tab.path.startsWith(safePath + '/') && tab.path !== safePath);

  let nextAction: FileOperationNextAction = null;
  if (currentNote && (currentNote.path === safePath || currentNote.path.startsWith(safePath + '/'))) {
    const lastTab = updatedTabs[updatedTabs.length - 1] as NoteTabState | undefined;
    if (lastTab) {
      nextAction = { type: 'open', path: lastTab.path };
    }
  }

  const updatedMetadata = remapMetadataEntries(noteMetadata ?? null, (relativePath) => {
    if (relativePath === safePath || relativePath.startsWith(safePath + '/')) {
      return null;
    }
    return relativePath;
  });

  const newChildren = rootFolder ? removeNodeFromTree(rootFolder.children, safePath) : [];

  return {
    updatedStarredEntries: starredResult.entries,
    updatedStarredFolders: starredPaths.folders,
    updatedStarredNotes: starredPaths.notes,
    updatedTabs,
    nextAction,
    updatedMetadata,
    newChildren,
    recoverableDelete,
  };
}
