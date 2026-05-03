import { getStorageAdapter, isAbsolutePath, joinPath } from '@/lib/storage/adapter';
import {
  buildFileTree,
  collectExpandedPaths,
  expandFoldersForPath,
  restoreExpandedState,
  updateFolderExpanded,
} from '../fileTreeUtils';
import { ensureFileNodeInTree } from '../fileTreePreservation';
import { DEFAULT_FILE_TREE_SORT_MODE, sortNestedFileTree } from '../fileTreeSorting';
import {
  ensureNotesFolder,
  getNotesBasePath,
  loadNoteMetadata,
  loadWorkspaceState,
} from '../storage';
import { getVaultStarredPaths } from '../starred';
import { persistWorkspaceSnapshot } from '../workspacePersistence';
import type { FileSystemSlice, FileSystemSliceGet, FileSystemSliceSet } from './fileSystemSliceContracts';

let pendingWorkspaceSnapshotTimeout: ReturnType<typeof setTimeout> | null = null;
let pendingWorkspaceSnapshotGet: FileSystemSliceGet | null = null;

function scheduleWorkspaceSnapshotPersistence(get: FileSystemSliceGet) {
  pendingWorkspaceSnapshotGet = get;

  if (pendingWorkspaceSnapshotTimeout !== null) {
    clearTimeout(pendingWorkspaceSnapshotTimeout);
  }

  pendingWorkspaceSnapshotTimeout = setTimeout(() => {
    const getSnapshotState = pendingWorkspaceSnapshotGet;
    pendingWorkspaceSnapshotGet = null;
    pendingWorkspaceSnapshotTimeout = null;

    if (!getSnapshotState) {
      return;
    }

    const { notesPath, rootFolder, currentNote, fileTreeSortMode } = getSnapshotState();
    if (rootFolder) {
      persistWorkspaceSnapshot(notesPath, {
        rootFolder,
        currentNotePath: currentNote?.path ?? null,
        fileTreeSortMode,
      });
    }
  }, 0);
}

export function createFileSystemTreeActions(
  set: FileSystemSliceSet,
  get: FileSystemSliceGet,
): Pick<FileSystemSlice, 'loadFileTree' | 'toggleFolder' | 'revealFolder' | 'setFileTreeSortMode'> {
  return {
    loadFileTree: async (skipRestore = false) => {
      const shouldShowLoading = !get().rootFolder;
      set(shouldShowLoading ? { isLoading: true, error: null } : { error: null });
      try {
        const storage = getStorageAdapter();
        const basePath = await getNotesBasePath();

        await ensureNotesFolder(basePath);
        const metadata = await loadNoteMetadata(basePath);
        const workspace = await loadWorkspaceState(basePath);
        const fileTreeSortMode = workspace?.fileTreeSortMode ?? DEFAULT_FILE_TREE_SORT_MODE;
        let children = sortNestedFileTree(await buildFileTree(basePath), {
          mode: fileTreeSortMode,
          metadata,
        });
        const currentNote = get().currentNote;
        if (currentNote && !isAbsolutePath(currentNote.path)) {
          children = sortNestedFileTree(ensureFileNodeInTree(children, currentNote.path), {
            mode: fileTreeSortMode,
            metadata,
          });
        }
        const starredPaths = getVaultStarredPaths(get().starredEntries, basePath);

        const currentExpandedPaths = get().rootFolder
          ? collectExpandedPaths(get().rootFolder?.children ?? [])
          : null;
        const restoredChildren = skipRestore
          ? (currentExpandedPaths ? restoreExpandedState(children, currentExpandedPaths) : children)
          : (workspace?.expandedFolders?.length
              ? restoreExpandedState(children, new Set(workspace.expandedFolders))
              : children);

        set({
          notesPath: basePath,
          rootFolder: {
            id: '',
            name: 'Notes',
            path: '',
            isFolder: true,
            children: restoredChildren,
            expanded: true,
          },
          noteMetadata: metadata,
          starredNotes: starredPaths.notes,
          starredFolders: starredPaths.folders,
          fileTreeSortMode,
        });

        const currentNotePath = workspace?.currentNotePath;
        if (!skipRestore && currentNotePath) {
          try {
            const fullPath = await joinPath(basePath, currentNotePath);
            if (await storage.exists(fullPath)) {
              await get().openNote(currentNotePath);
            }
          } catch {
          }
        }

        set({ isLoading: false });
      } catch (error) {
        set({
          error: error instanceof Error ? error.message : 'Failed to load notes',
          isLoading: false,
        });
      }
    },

    toggleFolder: (path: string) => {
      const { rootFolder } = get();
      if (!rootFolder) {
        return;
      }

      const updatedRootFolder = path === ''
        ? {
            ...rootFolder,
            expanded: !rootFolder.expanded,
          }
        : {
            ...rootFolder,
            children: updateFolderExpanded(rootFolder.children, path),
          };

      set({ rootFolder: updatedRootFolder });
      scheduleWorkspaceSnapshotPersistence(get);
    },

    revealFolder: (path: string) => {
      const { rootFolder } = get();
      if (!rootFolder) {
        return;
      }

      const updatedRootFolder = path === ''
        ? {
            ...rootFolder,
            expanded: true,
          }
        : {
            ...rootFolder,
            expanded: true,
            children: expandFoldersForPath(rootFolder.children, path),
          };

      set({ rootFolder: updatedRootFolder });
      scheduleWorkspaceSnapshotPersistence(get);
    },

    setFileTreeSortMode: async (mode) => {
      const { rootFolder, noteMetadata, fileTreeSortMode } = get();
      if (mode === fileTreeSortMode) {
        return;
      }

      const nextRootFolder = rootFolder
        ? {
            ...rootFolder,
            children: sortNestedFileTree(rootFolder.children, {
              mode,
              metadata: noteMetadata,
            }),
          }
        : rootFolder;

      set({
        fileTreeSortMode: mode,
        rootFolder: nextRootFolder,
      });

      scheduleWorkspaceSnapshotPersistence(get);
    },
  };
}
