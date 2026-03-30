import { isAbsolutePath } from '@/lib/storage/adapter';
import { collectExpandedPaths } from './fileTreeUtils';
import { saveWorkspaceState, type WorkspaceState } from './storage';
import type { NotesStore } from './types';

interface WorkspaceSnapshotInput {
  rootFolder: NotesStore['rootFolder'];
  currentNotePath: string | null | undefined;
  fileTreeSortMode: NotesStore['fileTreeSortMode'];
  expandedFolders?: string[];
}

export function createWorkspaceSnapshot({
  rootFolder,
  currentNotePath,
  fileTreeSortMode,
  expandedFolders,
}: WorkspaceSnapshotInput): WorkspaceState {
  const nextExpandedFolders =
    expandedFolders ?? (rootFolder ? Array.from(collectExpandedPaths(rootFolder.children)) : []);

  return {
    currentNotePath:
      currentNotePath && !isAbsolutePath(currentNotePath) ? currentNotePath : null,
    expandedFolders: nextExpandedFolders,
    fileTreeSortMode,
  };
}

export function persistWorkspaceSnapshot(
  notesPath: string,
  input: WorkspaceSnapshotInput
): void {
  if (!notesPath) {
    return;
  }

  void saveWorkspaceState(notesPath, createWorkspaceSnapshot(input));
}
