import { joinPath } from '@/lib/storage/adapter';
import { getVaultStarredPaths, remapStarredEntriesForVault, saveStarredRegistry } from '../../starred';
import { removeNodeFromTree } from '../../fileTreeUtils';
import { markExpectedExternalChange } from '../../document/externalChangeRegistry';
import { remapMetadataEntries } from '../../storage';
import { logNotesDebug } from '../../debugLog';
import { deleteNoteItemToRecoverableLocation } from './trashOperations';
import type {
  DeleteOperationResult,
  FileOperationContext,
  FileOperationNextAction,
  FileTreeChildren,
  NoteTabState,
} from './operationTypes';

function collectNotePaths(nodes: FileTreeChildren, result: string[] = []): string[] {
  for (const node of nodes) {
    if (node.isFolder) {
      collectNotePaths(node.children, result);
      continue;
    }

    result.push(node.path);
  }

  return result;
}

function resolveAdjacentNotePath(
  nodes: FileTreeChildren,
  targetPath: string,
  isRemovedPath: (path: string) => boolean,
): string | null {
  const notePaths = collectNotePaths(nodes);
  const currentIndex = notePaths.indexOf(targetPath);
  if (currentIndex === -1) {
    return null;
  }

  for (let index = currentIndex + 1; index < notePaths.length; index += 1) {
    const nextPath = notePaths[index];
    if (nextPath && !isRemovedPath(nextPath)) {
      return nextPath;
    }
  }

  for (let index = currentIndex - 1; index >= 0; index -= 1) {
    const previousPath = notePaths[index];
    if (previousPath && !isRemovedPath(previousPath)) {
      return previousPath;
    }
  }

  return null;
}

export async function deleteNoteImpl(
  notesPath: string,
  path: string,
  currentStore: FileOperationContext,
): Promise<DeleteOperationResult> {
  const fullPath = await joinPath(notesPath, path);
  logNotesDebug('deleteNoteImpl:start', {
    notePath: path,
    fullPath,
    currentNotePath: currentStore.currentNote?.path ?? null,
    openTabCount: currentStore.openTabs.length,
  });
  markExpectedExternalChange(fullPath);
  const recoverableDelete = await deleteNoteItemToRecoverableLocation(notesPath, path, 'file');

  const { openTabs, starredEntries, currentNote, rootFolder, noteMetadata } = currentStore;

  const updatedTabs = openTabs.filter((tab) => tab.path !== path);
  const starredResult = remapStarredEntriesForVault(starredEntries, notesPath, (relativePath, kind) => {
    if (kind !== 'note') {
      return relativePath;
    }
    return relativePath === path ? null : relativePath;
  });
  const starredPaths = getVaultStarredPaths(starredResult.entries, notesPath);
  if (starredResult.changed) {
    void saveStarredRegistry(starredResult.entries);
  }

  const newChildren = rootFolder ? removeNodeFromTree(rootFolder.children, path) : [];
  let nextAction: FileOperationNextAction = null;

  if (currentNote?.path === path) {
    const adjacentNotePath = resolveAdjacentNotePath(
      rootFolder?.children ?? [],
      path,
      (candidatePath) => candidatePath === path,
    );
    if (adjacentNotePath) {
      nextAction = { type: 'open', path: adjacentNotePath };
    } else {
      const lastTab = updatedTabs[updatedTabs.length - 1] as NoteTabState | undefined;
      if (lastTab) {
        nextAction = { type: 'open', path: lastTab.path };
      }
    }
  }

  const updatedMetadata = remapMetadataEntries(noteMetadata ?? null, (relativePath) =>
    relativePath === path ? null : relativePath,
  );

  logNotesDebug('deleteNoteImpl:finish', {
    notePath: path,
    nextAction,
    remainingTabCount: updatedTabs.length,
  });

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
  const fullPath = await joinPath(notesPath, path);
  markExpectedExternalChange(fullPath, true);
  const recoverableDelete = await deleteNoteItemToRecoverableLocation(notesPath, path, 'folder');

  const { openTabs, starredEntries, currentNote, rootFolder, noteMetadata } = currentStore;

  const starredResult = remapStarredEntriesForVault(starredEntries, notesPath, (relativePath) => {
    if (relativePath === path || relativePath.startsWith(path + '/')) {
      return null;
    }
    return relativePath;
  });
  const starredPaths = getVaultStarredPaths(starredResult.entries, notesPath);
  if (starredResult.changed) {
    void saveStarredRegistry(starredResult.entries);
  }

  const updatedTabs = openTabs.filter((tab) => !tab.path.startsWith(path + '/') && tab.path !== path);

  let nextAction: FileOperationNextAction = null;
  if (currentNote && (currentNote.path === path || currentNote.path.startsWith(path + '/'))) {
    const adjacentNotePath = resolveAdjacentNotePath(
      rootFolder?.children ?? [],
      currentNote.path,
      (candidatePath) => candidatePath === path || candidatePath.startsWith(path + '/'),
    );
    if (adjacentNotePath) {
      nextAction = { type: 'open', path: adjacentNotePath };
    } else {
      const lastTab = updatedTabs[updatedTabs.length - 1] as NoteTabState | undefined;
      if (lastTab) {
        nextAction = { type: 'open', path: lastTab.path };
      }
    }
  }

  const updatedMetadata = remapMetadataEntries(noteMetadata ?? null, (relativePath) => {
    if (relativePath === path || relativePath.startsWith(path + '/')) {
      return null;
    }
    return relativePath;
  });

  const newChildren = rootFolder ? removeNodeFromTree(rootFolder.children, path) : [];

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
