import { getStorageAdapter, isAbsolutePath } from '@/lib/storage/adapter';
import { isSupportedMarkdownPath } from '@/lib/notes/markdownFile';
import { recordDiagnostic } from '@/lib/diagnostics/appDiagnostics';
import {
  buildFileTree,
  collectExpandedPaths,
  expandFoldersForPath,
  isGitRepositoryDirectory,
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
import { hasInternalNotePathSegment } from '../utils/fs/internalNotePaths';
import { normalizeVaultRelativePath, resolveVaultRelativeFullPath } from '../utils/fs/vaultPathContainment';
import { persistWorkspaceSnapshot } from '../workspacePersistence';
import type { FileSystemSlice, FileSystemSliceGet, FileSystemSliceSet } from './fileSystemSliceContracts';

let pendingWorkspaceSnapshotTimeout: ReturnType<typeof setTimeout> | null = null;
let pendingWorkspaceSnapshotGet: FileSystemSliceGet | null = null;
let latestLoadFileTreeRequestId = 0;

export function getWorkspaceRestoreCandidatePaths({
  currentNotePath,
  starredNotes,
  recentNotes,
}: {
  currentNotePath?: string | null;
  starredNotes: string[];
  recentNotes: string[];
}): string[] {
  const candidates = [
    ...(currentNotePath ? [currentNotePath] : []),
    ...starredNotes,
    ...recentNotes,
  ];
  const seen = new Set<string>();
  const normalizedCandidates: string[] = [];

  for (const candidate of candidates) {
    const normalizedPath = normalizeVaultRelativePath(candidate);
    if (
      !normalizedPath ||
      hasInternalNotePathSegment(normalizedPath) ||
      isDraftNotePath(normalizedPath) ||
      !isSupportedMarkdownPath(normalizedPath) ||
      seen.has(normalizedPath)
    ) {
      continue;
    }

    seen.add(normalizedPath);
    normalizedCandidates.push(normalizedPath);
  }

  return normalizedCandidates;
}

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
      const timings: Array<{ step: string; durationMs: number }> = [];
      const markStep = (step: string, stepStartedAt: number) => {
        timings.push({
          step,
          durationMs: roundFileTreeLoadPerfMs(getFileTreeLoadPerfNow() - stepStartedAt),
        });
      };
      const shouldShowLoading = !get().rootFolder;
      recordDiagnostic('notes.fileTree', 'load_start', {
        requestId,
        skipRestore,
        shouldShowLoading,
        currentVaultPath: getCurrentVaultPath(),
        notesPath: get().notesPath,
        rootFolderPath: get().rootFolderPath,
        hasRootFolder: Boolean(get().rootFolder),
      });
      set(shouldShowLoading ? { isLoading: true, error: null } : { error: null });
      try {
        let stepStartedAt = getFileTreeLoadPerfNow();
        const storage = getStorageAdapter();
        const basePath = await getNotesBasePath();
        markStep('resolve-base-path', stepStartedAt);
        recordDiagnostic('notes.fileTree', 'base_path_resolved', {
          requestId,
          basePath,
          currentVaultPath: getCurrentVaultPath(),
        });

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
        recordDiagnostic('notes.fileTree', 'tree_built', {
          requestId,
          basePath,
          builtChildren: builtChildren.length,
          fileTreeSortMode,
        });

        stepStartedAt = getFileTreeLoadPerfNow();
        const isRootGitRepository = await isGitRepositoryDirectory(basePath);
        markStep('detect-root-git', stepStartedAt);

        stepStartedAt = getFileTreeLoadPerfNow();
        let children = sortNestedFileTree(builtChildren, {
          mode: fileTreeSortMode,
          metadata,
        });
        markStep('sort-tree', stepStartedAt);
        if (requestId !== latestLoadFileTreeRequestId || getCurrentVaultPath() !== basePath) {
          recordDiagnostic('notes.fileTree', 'stale_return_after_sort', {
            requestId,
            latestLoadFileTreeRequestId,
            basePath,
            currentVaultPath: getCurrentVaultPath(),
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
          recordDiagnostic('notes.fileTree', 'stale_return_after_restore', {
            requestId,
            latestLoadFileTreeRequestId,
            basePath,
            currentVaultPath: getCurrentVaultPath(),
            restoredChildren: restoredChildren.length,
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
            ...(isRootGitRepository ? { isGitRepository: true } : {}),
          },
          noteMetadata: nextMetadata,
          starredNotes: starredPaths.notes,
          starredFolders: starredPaths.folders,
          fileTreeSortMode,
        });
        markStep('set-state', stepStartedAt);
        recordDiagnostic('notes.fileTree', 'state_set', {
          requestId,
          basePath,
          restoredChildren: restoredChildren.length,
          fileTreeSortMode,
          isRootGitRepository,
          currentNotePath: get().currentNote?.path ?? null,
          timings,
        });

        const restoreCandidatePaths = getWorkspaceRestoreCandidatePaths({
          currentNotePath: workspace?.currentNotePath,
          starredNotes: starredPaths.notes,
          recentNotes: get().recentNotes,
        });
        const hasActiveNoteOrTabs = Boolean(get().currentNote) || get().openTabs.length > 0;
        if (!skipRestore && restoreCandidatePaths.length > 0 && !hasActiveNoteOrTabs) {
          for (const candidatePath of restoreCandidatePaths) {
            try {
              const { relativePath, fullPath } = await resolveVaultRelativeFullPath(basePath, candidatePath);
              if (
                requestId === latestLoadFileTreeRequestId &&
                getCurrentVaultPath() === basePath &&
                await storage.exists(fullPath)
              ) {
                await get().openNote(relativePath);
                break;
              }
            } catch {
              // Ignore stale persisted current-note, starred, or recent entries.
            }
          }
        }

        if (requestId === latestLoadFileTreeRequestId && getCurrentVaultPath() === basePath) {
          set({ isLoading: false });
          recordDiagnostic('notes.fileTree', 'load_complete', {
            requestId,
            basePath,
            rootFolderChildren: get().rootFolder?.children.length ?? null,
            timings,
          });
        }
      } catch (error) {
        if (requestId === latestLoadFileTreeRequestId) {
          if (isNoVaultSelectedError(error)) {
            set({ error: null, isLoading: false });
            recordDiagnostic('notes.fileTree', 'no_vault_selected', {
              requestId,
              timings,
            });
            return;
          }
          set({
            error: error instanceof Error ? error.message : 'Failed to load notes',
            isLoading: false,
          });
          recordDiagnostic('notes.fileTree', 'load_failed', {
            requestId,
            error,
            timings,
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
