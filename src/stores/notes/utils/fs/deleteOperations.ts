import { removeNodeFromTree } from '../../fileTreeUtils';
import { markExpectedExternalChange } from '../../document/externalChangeRegistry';
import { assertNonInternalNotePath } from './internalNotePaths';
import { deleteNoteItemToPendingTrash } from './trashOperations';
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
  assertNonInternalNotePath(safePath);
  markExpectedExternalChange(fullPath);
  const trashedItem = await deleteNoteItemToPendingTrash(notesPath, safePath, 'file');

  const { openTabs, currentNote, rootFolder } = currentStore;

  const updatedTabs = openTabs.filter((tab) => tab.path !== safePath);
  const newChildren = rootFolder ? removeNodeFromTree(rootFolder.children, safePath) : [];
  let nextAction: FileOperationNextAction = null;

  if (currentNote?.path === safePath) {
    const lastTab = updatedTabs[updatedTabs.length - 1] as NoteTabState | undefined;
    if (lastTab) {
      nextAction = { type: 'open', path: lastTab.path };
    }
  }

  return {
    updatedTabs,
    nextAction,
    newChildren,
    trashedItem,
  };
}

export async function deleteFolderImpl(
  notesPath: string,
  path: string,
  currentStore: FileOperationContext,
): Promise<DeleteOperationResult> {
  const { relativePath: safePath, fullPath } = await resolveVaultRelativeFullPath(notesPath, path);
  assertNonInternalNotePath(safePath);
  markExpectedExternalChange(fullPath, true);
  const trashedItem = await deleteNoteItemToPendingTrash(notesPath, safePath, 'folder');

  const { openTabs, currentNote, rootFolder } = currentStore;

  const updatedTabs = openTabs.filter((tab) => !tab.path.startsWith(safePath + '/') && tab.path !== safePath);

  let nextAction: FileOperationNextAction = null;
  if (currentNote && (currentNote.path === safePath || currentNote.path.startsWith(safePath + '/'))) {
    const lastTab = updatedTabs[updatedTabs.length - 1] as NoteTabState | undefined;
    if (lastTab) {
      nextAction = { type: 'open', path: lastTab.path };
    }
  }

  const newChildren = rootFolder ? removeNodeFromTree(rootFolder.children, safePath) : [];

  return {
    updatedTabs,
    nextAction,
    newChildren,
    trashedItem,
  };
}
