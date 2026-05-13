import { getStorageAdapter, isAbsolutePath } from '@/lib/storage/adapter';
import {
  buildFileTree,
  countFileTreeNodes,
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
import { logNotesDebug } from '../lineBreakDebugLog';
import { getVaultStarredPaths } from '../starred';
import { resolveVaultRelativeFullPath } from '../utils/fs/vaultPathContainment';
import { persistWorkspaceSnapshot } from '../workspacePersistence';
import type { FileSystemSlice, FileSystemSliceGet, FileSystemSliceSet } from './fileSystemSliceContracts';

let pendingWorkspaceSnapshotTimeout: ReturnType<typeof setTimeout> | null = null;
let pendingWorkspaceSnapshotGet: FileSystemSliceGet | null = null;
let latestLoadFileTreeRequestId = 0;

function getFileTreeLoadPerfNow() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function roundFileTreeLoadPerfMs(value: number) {
  return Math.round(value * 100) / 100;
}

function isNoVaultSelectedError(error: unknown): boolean {
  return error instanceof Error && error.message === 'No vault selected';
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
    loadFileTree: async (skipRestore = false) => {
      const requestId = ++latestLoadFileTreeRequestId;
      const startedAt = getFileTreeLoadPerfNow();
      const timings: Array<{ step: string; durationMs: number }> = [];
      const markStep = (step: string, stepStartedAt: number) => {
        timings.push({
          step,
          durationMs: roundFileTreeLoadPerfMs(getFileTreeLoadPerfNow() - stepStartedAt),
        });
      };
      const shouldShowLoading = !get().rootFolder;
      logNotesDebug('NotesLoad', 'file-tree:start', {
        requestId,
        skipRestore,
        shouldShowLoading,
        currentNotesPath: get().notesPath,
        hasRootFolder: Boolean(get().rootFolder),
      });
      set(shouldShowLoading ? { isLoading: true, error: null } : { error: null });
      try {
        let stepStartedAt = getFileTreeLoadPerfNow();
        const storage = getStorageAdapter();
        const basePath = await getNotesBasePath();
        markStep('resolve-base-path', stepStartedAt);

        stepStartedAt = getFileTreeLoadPerfNow();
        await ensureNotesFolder(basePath);
        markStep('ensure-folder', stepStartedAt);

        stepStartedAt = getFileTreeLoadPerfNow();
        const metadata = await loadNoteMetadata(basePath);
        markStep('metadata', stepStartedAt);

        stepStartedAt = getFileTreeLoadPerfNow();
        const workspace = await loadWorkspaceState(basePath);
        markStep('workspace-state', stepStartedAt);

        stepStartedAt = getFileTreeLoadPerfNow();
        const fileTreeSortMode = workspace?.fileTreeSortMode ?? DEFAULT_FILE_TREE_SORT_MODE;
        const builtChildren = await buildFileTree(basePath);
        markStep('build-tree', stepStartedAt);

        stepStartedAt = getFileTreeLoadPerfNow();
        let children = sortNestedFileTree(builtChildren, {
          mode: fileTreeSortMode,
          metadata,
        });
        markStep('sort-tree', stepStartedAt);
        if (requestId !== latestLoadFileTreeRequestId || getCurrentVaultPath() !== basePath) {
          logNotesDebug('NotesLoad', 'file-tree:stale-after-build', {
            requestId,
            latestLoadFileTreeRequestId,
            basePath,
            activeVaultPath: getCurrentVaultPath(),
            totalDurationMs: roundFileTreeLoadPerfMs(getFileTreeLoadPerfNow() - startedAt),
            timings,
          });
          return;
        }

        const currentNote = get().currentNote;
        if (currentNote && !isAbsolutePath(currentNote.path) && !isDraftNotePath(currentNote.path)) {
          stepStartedAt = getFileTreeLoadPerfNow();
          children = sortNestedFileTree(ensureFileNodeInTree(children, currentNote.path), {
            mode: fileTreeSortMode,
            metadata,
          });
          markStep('ensure-current-note', stepStartedAt);
        }

        stepStartedAt = getFileTreeLoadPerfNow();
        const starredPaths = getVaultStarredPaths(get().starredEntries, basePath);
        markStep('starred-paths', stepStartedAt);

        stepStartedAt = getFileTreeLoadPerfNow();
        const currentExpandedPaths = get().rootFolder && get().rootFolderPath === basePath
          ? collectExpandedPaths(get().rootFolder?.children ?? [])
          : null;
        const restoredChildren = skipRestore
          ? (currentExpandedPaths ? restoreExpandedState(children, currentExpandedPaths) : children)
          : (workspace?.expandedFolders?.length
              ? restoreExpandedState(children, new Set(workspace.expandedFolders))
              : children);
        markStep('restore-expanded', stepStartedAt);

        if (requestId !== latestLoadFileTreeRequestId || getCurrentVaultPath() !== basePath) {
          logNotesDebug('NotesLoad', 'file-tree:stale-before-set', {
            requestId,
            latestLoadFileTreeRequestId,
            basePath,
            activeVaultPath: getCurrentVaultPath(),
            totalDurationMs: roundFileTreeLoadPerfMs(getFileTreeLoadPerfNow() - startedAt),
            timings,
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

        stepStartedAt = getFileTreeLoadPerfNow();
        set({
          notesPath: basePath,
          rootFolderPath: basePath,
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
        markStep('set-state', stepStartedAt);
        const restoredCounts = countFileTreeNodes(restoredChildren);
        logNotesDebug('NotesLoad', 'file-tree:ready', {
          requestId,
          basePath,
          skipRestore,
          fileTreeSortMode,
          totalDurationMs: roundFileTreeLoadPerfMs(getFileTreeLoadPerfNow() - startedAt),
          timings,
          rootNodeCount: restoredChildren.length,
          nodeCount: restoredCounts.nodes,
          folderCount: restoredCounts.folders,
          fileCount: restoredCounts.files,
          metadataEntryCount: Object.keys(nextMetadata.notes).length,
          workspaceHadCurrentNote: Boolean(workspace?.currentNotePath),
          workspaceExpandedFolderCount: workspace?.expandedFolders?.length ?? 0,
          restoredFromCurrentExpanded: Boolean(skipRestore && currentExpandedPaths),
          starredNoteCount: starredPaths.notes.length,
          starredFolderCount: starredPaths.folders.length,
        });

        const currentNotePath = workspace?.currentNotePath;
        const hasActiveNoteOrTabs = Boolean(get().currentNote) || get().openTabs.length > 0;
        if (!skipRestore && currentNotePath && !hasActiveNoteOrTabs) {
          try {
            const { relativePath, fullPath } = await resolveVaultRelativeFullPath(basePath, currentNotePath);
            if (
              requestId === latestLoadFileTreeRequestId &&
              getCurrentVaultPath() === basePath &&
              await storage.exists(fullPath)
            ) {
              await get().openNote(relativePath);
              logNotesDebug('NotesLoad', 'file-tree:restored-current-note', {
                requestId,
                basePath,
                relativePath,
                totalDurationMs: roundFileTreeLoadPerfMs(getFileTreeLoadPerfNow() - startedAt),
              });
            }
          } catch {
            // Ignore stale persisted current-note entries.
          }
        }

        if (requestId === latestLoadFileTreeRequestId && getCurrentVaultPath() === basePath) {
          set({ isLoading: false });
          logNotesDebug('NotesLoad', 'file-tree:done', {
            requestId,
            basePath,
            totalDurationMs: roundFileTreeLoadPerfMs(getFileTreeLoadPerfNow() - startedAt),
            restoredCurrentNote: Boolean(!skipRestore && currentNotePath && !hasActiveNoteOrTabs),
          });
        }
      } catch (error) {
        if (requestId === latestLoadFileTreeRequestId) {
          if (isNoVaultSelectedError(error)) {
            logNotesDebug('NotesLoad', 'file-tree:skipped-no-vault', {
              requestId,
              skipRestore,
              totalDurationMs: roundFileTreeLoadPerfMs(getFileTreeLoadPerfNow() - startedAt),
              timings,
            });
            set({ error: null, isLoading: false });
            return;
          }
          logNotesDebug('NotesLoad', 'file-tree:failed', {
            requestId,
            skipRestore,
            totalDurationMs: roundFileTreeLoadPerfMs(getFileTreeLoadPerfNow() - startedAt),
            timings,
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
