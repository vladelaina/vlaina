import {
  expandFoldersForPath,
  updateFolderExpanded,
} from '../fileTreeUtils';
import { buildSortedRootFolder } from '../utils/fs/rootFolderState';
import { persistWorkspaceSnapshot } from '../workspacePersistence';
import type { FileSystemSlice, FileSystemSliceGet, FileSystemSliceSet } from './fileSystemSliceContracts';
import {
  createLoadFileTreeAction,
  getWorkspaceRestoreCandidatePaths,
  invalidatePendingFileTreeLoads,
} from './fileSystemSliceTreeLoadAction';

let pendingWorkspaceSnapshotTimeout: ReturnType<typeof setTimeout> | null = null;
let pendingWorkspaceSnapshotGet: FileSystemSliceGet | null = null;

export { getWorkspaceRestoreCandidatePaths, invalidatePendingFileTreeLoads };

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

    const { notesPath, rootFolder, rootFolderPath, currentNote, fileTreeSortMode } = getSnapshotState();
    if (rootFolder && rootFolderPath === notesPath) {
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
    loadFileTree: createLoadFileTreeAction(set, get),

    toggleFolder: (path: string) => {
      const { rootFolder } = get();
      if (!rootFolder) {
        return;
      }

      if (path === '' && rootFolder.children.length === 0) {
        if (!rootFolder.expanded) {
          set({ rootFolder: { ...rootFolder, expanded: true } });
        }
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

      if (updatedRootFolder.children === rootFolder.children && updatedRootFolder.expanded === rootFolder.expanded) {
        return;
      }

      set({ rootFolder: updatedRootFolder });
      scheduleWorkspaceSnapshotPersistence(get);
    },

    revealFolder: (path: string) => {
      const { rootFolder } = get();
      if (!rootFolder) {
        return;
      }

      const nextChildren = path === ''
        ? rootFolder.children
        : expandFoldersForPath(rootFolder.children, path);
      if (rootFolder.expanded && nextChildren === rootFolder.children) {
        return;
      }

      const updatedRootFolder = {
        ...rootFolder,
        expanded: true,
        children: nextChildren,
      };

      set({ rootFolder: updatedRootFolder });
      scheduleWorkspaceSnapshotPersistence(get);
    },

    setFileTreeSortMode: async (mode) => {
      const { rootFolder, noteMetadata, fileTreeSortMode } = get();
      if (mode === fileTreeSortMode) {
        return;
      }

      const nextRootFolder = buildSortedRootFolder(
        rootFolder,
        rootFolder?.children ?? [],
        mode,
        noteMetadata,
      );

      set({
        fileTreeSortMode: mode,
        rootFolder: nextRootFolder,
      });

      scheduleWorkspaceSnapshotPersistence(get);
    },
  };
}
