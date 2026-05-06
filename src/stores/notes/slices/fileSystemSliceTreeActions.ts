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
import { isDraftNotePath } from '../draftNote';
import {
  ensureNotesFolder,
  getCurrentVaultPath,
  getNotesBasePath,
  loadNoteMetadata,
  loadWorkspaceState,
} from '../storage';
import { getVaultStarredPaths } from '../starred';
import { persistWorkspaceSnapshot } from '../workspacePersistence';
import { logNotesDebug } from '../lineBreakDebugLog';
import type { FileSystemSlice, FileSystemSliceGet, FileSystemSliceSet } from './fileSystemSliceContracts';

let pendingWorkspaceSnapshotTimeout: ReturnType<typeof setTimeout> | null = null;
let pendingWorkspaceSnapshotGet: FileSystemSliceGet | null = null;
let latestLoadFileTreeRequestId = 0;

function summarizeFileTreeChildren(children: Awaited<ReturnType<typeof buildFileTree>>) {
  let fileCount = 0;
  let folderCount = 0;

  const visit = (nodes: typeof children) => {
    for (const node of nodes) {
      if (node.isFolder) {
        folderCount += 1;
        visit(node.children);
      } else {
        fileCount += 1;
      }
    }
  };

  visit(children);

  return {
    rootChildrenLength: children.length,
    fileCount,
    folderCount,
    rootChildPreview: children.slice(0, 8).map((node) => ({
      path: node.path,
      name: node.name,
      isFolder: node.isFolder,
      childCount: node.isFolder ? node.children.length : null,
    })),
  };
}

export function invalidatePendingFileTreeLoads() {
  latestLoadFileTreeRequestId += 1;
}

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
      const requestId = ++latestLoadFileTreeRequestId;
      const shouldShowLoading = !get().rootFolder;
      logNotesDebug('NotesFileTree', 'load:start', {
        requestId,
        skipRestore,
        shouldShowLoading,
        currentVaultPath: getCurrentVaultPath(),
        existingNotesPath: get().notesPath,
        existingRootFolderLoaded: Boolean(get().rootFolder),
        existingRootChildrenLength: get().rootFolder?.children.length ?? null,
        currentNotePath: get().currentNote?.path ?? null,
        openTabsLength: get().openTabs.length,
      });
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
        logNotesDebug('NotesFileTree', 'load:built', {
          requestId,
          basePath,
          fileTreeSortMode,
          workspaceCurrentNotePath: workspace?.currentNotePath ?? null,
          workspaceExpandedFoldersLength: workspace?.expandedFolders?.length ?? 0,
          summary: summarizeFileTreeChildren(children),
        });
        if (requestId !== latestLoadFileTreeRequestId || getCurrentVaultPath() !== basePath) {
          logNotesDebug('NotesFileTree', 'load:stale-after-build', {
            requestId,
            latestLoadFileTreeRequestId,
            basePath,
            currentVaultPath: getCurrentVaultPath(),
          });
          return;
        }

        const currentNote = get().currentNote;
        if (currentNote && !isAbsolutePath(currentNote.path) && !isDraftNotePath(currentNote.path)) {
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

        if (requestId !== latestLoadFileTreeRequestId || getCurrentVaultPath() !== basePath) {
          logNotesDebug('NotesFileTree', 'load:stale-before-set', {
            requestId,
            latestLoadFileTreeRequestId,
            basePath,
            currentVaultPath: getCurrentVaultPath(),
          });
          return;
        }

        const currentMetadata = get().noteMetadata;
        const draftMetadataEntries = Object.entries(currentMetadata?.notes ?? {})
          .filter(([path]) => isDraftNotePath(path));
        const nextMetadata = draftMetadataEntries.length > 0
          ? {
              ...metadata,
              notes: {
                ...metadata.notes,
                ...Object.fromEntries(draftMetadataEntries),
              },
            }
          : metadata;

        logNotesDebug('NotesFileTree', 'load:set-root', {
          requestId,
          basePath,
          skipRestore,
          restoredSummary: summarizeFileTreeChildren(restoredChildren),
          starredNotesLength: starredPaths.notes.length,
          starredFoldersLength: starredPaths.folders.length,
          draftMetadataEntriesLength: draftMetadataEntries.length,
        });
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
          noteMetadata: nextMetadata,
          starredNotes: starredPaths.notes,
          starredFolders: starredPaths.folders,
          fileTreeSortMode,
        });

        const currentNotePath = workspace?.currentNotePath;
        const hasActiveNoteOrTabs = Boolean(get().currentNote) || get().openTabs.length > 0;
        if (!skipRestore && currentNotePath && !hasActiveNoteOrTabs) {
          logNotesDebug('NotesFileTree', 'load:restore-current:evaluate', {
            requestId,
            basePath,
            currentNotePath,
            hasActiveNoteOrTabs,
          });
          try {
            const fullPath = await joinPath(basePath, currentNotePath);
            if (
              requestId === latestLoadFileTreeRequestId &&
              getCurrentVaultPath() === basePath &&
              await storage.exists(fullPath)
            ) {
              logNotesDebug('NotesFileTree', 'load:restore-current:open', {
                requestId,
                currentNotePath,
                fullPath,
              });
              await get().openNote(currentNotePath);
            }
          } catch {
            logNotesDebug('NotesFileTree', 'load:restore-current:failed', {
              requestId,
              currentNotePath,
            });
          }
        }

        if (requestId === latestLoadFileTreeRequestId && getCurrentVaultPath() === basePath) {
          set({ isLoading: false });
          logNotesDebug('NotesFileTree', 'load:completed', {
            requestId,
            basePath,
            rootChildrenLength: get().rootFolder?.children.length ?? null,
            currentNotePath: get().currentNote?.path ?? null,
            openTabsLength: get().openTabs.length,
          });
        }
      } catch (error) {
        if (requestId === latestLoadFileTreeRequestId) {
          logNotesDebug('NotesFileTree', 'load:failed', {
            requestId,
            message: error instanceof Error ? error.message : String(error),
          });
          set({
            error: error instanceof Error ? error.message : 'Failed to load notes',
            isLoading: false,
          });
        }
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
