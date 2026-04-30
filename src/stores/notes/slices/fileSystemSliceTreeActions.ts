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

export function createFileSystemTreeActions(
  set: FileSystemSliceSet,
  get: FileSystemSliceGet,
): Pick<FileSystemSlice, 'loadFileTree' | 'toggleFolder' | 'revealFolder' | 'setFileTreeSortMode'> {
  return {
    loadFileTree: async (skipRestore = false) => {
      set({ isLoading: true, error: null });
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
          isLoading: false,
          fileTreeSortMode,
        });

        const currentNotePath = workspace?.currentNotePath;
        if (!skipRestore && currentNotePath) {
          setTimeout(async () => {
            try {
              const fullPath = await joinPath(basePath, currentNotePath);
              if (await storage.exists(fullPath)) {
                get().openNote(currentNotePath);
              }
            } catch {
            }
          }, 0);
        }
      } catch (error) {
        set({
          error: error instanceof Error ? error.message : 'Failed to load notes',
          isLoading: false,
        });
      }
    },

    toggleFolder: (path: string) => {
      const { rootFolder, notesPath, fileTreeSortMode } = get();
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
      const { currentNote } = get();

      set({ rootFolder: updatedRootFolder });
      persistWorkspaceSnapshot(notesPath, {
        rootFolder: updatedRootFolder,
        currentNotePath: currentNote?.path ?? null,
        fileTreeSortMode,
      });
    },

    revealFolder: (path: string) => {
      const { rootFolder, notesPath, currentNote, fileTreeSortMode } = get();
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
      persistWorkspaceSnapshot(notesPath, {
        rootFolder: updatedRootFolder,
        currentNotePath: currentNote?.path ?? null,
        fileTreeSortMode,
      });
    },

    setFileTreeSortMode: async (mode) => {
      const { rootFolder, noteMetadata, notesPath, currentNote, fileTreeSortMode } = get();
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

      persistWorkspaceSnapshot(notesPath, {
        rootFolder: nextRootFolder,
        currentNotePath: currentNote?.path ?? null,
        fileTreeSortMode: mode,
      });
    },
  };
}
