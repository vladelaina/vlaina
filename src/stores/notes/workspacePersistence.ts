import { isAbsolutePath } from '@/lib/storage/adapter';
import { collectExpandedPaths } from './fileTreeUtils';
import { normalizeWorkspaceState } from './persistenceValidation';
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

  return normalizeWorkspaceState({
    currentNotePath:
      currentNotePath && !isAbsolutePath(currentNotePath) ? currentNotePath : null,
    expandedFolders: nextExpandedFolders,
    fileTreeSortMode,
  }) ?? {
    currentNotePath: null,
    expandedFolders: [],
    fileTreeSortMode,
  };
}

export function persistWorkspaceSnapshot(
  notesPath: string,
  input: WorkspaceSnapshotInput
): void {
  void Promise.resolve(saveWorkspaceSnapshot(notesPath, input)).catch(() => undefined);
}

export async function saveWorkspaceSnapshot(
  notesPath: string,
  input: WorkspaceSnapshotInput
): Promise<void> {
  if (!notesPath) {
    return;
  }

  await saveWorkspaceState(notesPath, createWorkspaceSnapshot(input));
}
