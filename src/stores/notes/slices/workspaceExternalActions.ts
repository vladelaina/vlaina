import type { NotesGet, NotesSet, WorkspaceSlice } from './workspaceSliceTypes';
import { applyExternalPathDeletionAction } from './workspaceExternalDeleteAction';
import { applyExternalPathRenameAction } from './workspaceExternalRenameAction';

export function createWorkspaceExternalActions(
  set: NotesSet,
  get: NotesGet
): Pick<WorkspaceSlice, 'applyExternalPathRename' | 'applyExternalPathDeletion'> {
  return {
    applyExternalPathRename: (oldPath, newPath) =>
      applyExternalPathRenameAction(set, get, oldPath, newPath),
    applyExternalPathDeletion: (path, options) =>
      applyExternalPathDeletionAction(set, get, path, options),
  };
}
