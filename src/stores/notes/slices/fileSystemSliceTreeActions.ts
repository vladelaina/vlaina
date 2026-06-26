import { getStorageAdapter, isAbsolutePath } from '@/lib/storage/adapter';
import { isSupportedMarkdownPath } from '@/lib/notes/markdownFile';
import {
  buildFileTree,
  buildFileTreeLevel,
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
  createEmptyMetadataFile,
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
const BACKGROUND_FILE_TREE_LOAD_DELAY_MS = 100;

function mergeDraftMetadata(
  metadata: ReturnType<typeof createEmptyMetadataFile>,
  currentMetadata: ReturnType<FileSystemSliceGet>['noteMetadata'],
) {
  const draftMetadataEntries = Object.entries(currentMetadata?.notes ?? {})
    .filter(([path]) => isDraftNotePath(path));
  return draftMetadataEntries.length > 0
    ? {
        ...metadata,
        notes: {
          ...metadata.notes,
          ...Object.fromEntries(draftMetadataEntries),
        },
      }
    : metadata;
}

function getExpandedPathsForBackgroundTreeRestore(
  currentExpandedPaths: Set<string> | null,
  workspaceExpandedFolders: string[] | undefined,
  skipRestore: boolean,
) {
  if (skipRestore) {
    return currentExpandedPaths;
  }

  const expandedPaths = new Set(workspaceExpandedFolders ?? []);
  if (currentExpandedPaths) {
    for (const expandedPath of currentExpandedPaths) {
      expandedPaths.add(expandedPath);
    }
  }
  return expandedPaths.size > 0 ? expandedPaths : null;
}

function scheduleBackgroundFileTreeLoad(task: () => Promise<void>) {
  setTimeout(() => {
    void task().catch(() => undefined);
  }, BACKGROUND_FILE_TREE_LOAD_DELAY_MS);
}

export function getWorkspaceRestoreCandidatePaths({
  currentNotePath,
}: {
  currentNotePath?: string | null;
}): string[] {
  const candidates = currentNotePath ? [currentNotePath] : [];
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
      set({ error: null });
      try {
        const storage = getStorageAdapter();
        const basePath = await getNotesBasePath();

        await ensureNotesFolder(basePath);

        const workspace = await loadWorkspaceState(basePath);

        const fileTreeSortMode = workspace?.fileTreeSortMode ?? DEFAULT_FILE_TREE_SORT_MODE;
        const shouldBuildShallowInitialTree = !(get().rootFolder && get().rootFolderPath === basePath);
        if (shouldBuildShallowInitialTree) {
          set({
            notesPath: basePath,
            rootFolderPath: null,
            rootFolder: null,
            isLoading: true,
          });
        }
        const builtChildren = shouldBuildShallowInitialTree
          ? await buildFileTreeLevel(basePath, '', undefined, { detectGitRepositories: false })
          : await buildFileTree(basePath);

        const isRootGitRepository = await isGitRepositoryDirectory(basePath);
        const initialMetadata = mergeDraftMetadata(createEmptyMetadataFile(), get().noteMetadata);

        let children = sortNestedFileTree(builtChildren, {
          mode: fileTreeSortMode,
          metadata: initialMetadata,
        });
        if (requestId !== latestLoadFileTreeRequestId || getCurrentVaultPath() !== basePath) {
          return;
        }

        const stateBeforeCurrentNotePreservation = get();
        const currentNote = stateBeforeCurrentNotePreservation.currentNote;
        if (currentNote && !isAbsolutePath(currentNote.path) && !isDraftNotePath(currentNote.path)) {
          const currentTab = stateBeforeCurrentNotePreservation.openTabs.find(
            (tab) => tab.path === currentNote.path
          );
          let shouldPreserveCurrentNoteInTree =
            stateBeforeCurrentNotePreservation.isDirty || currentTab?.isDirty === true;

          if (!shouldPreserveCurrentNoteInTree) {
            try {
              const { fullPath } = await resolveVaultRelativeFullPath(basePath, currentNote.path);
              shouldPreserveCurrentNoteInTree = await storage.exists(fullPath);
            } catch {
              shouldPreserveCurrentNoteInTree = false;
            }
          }

          if (requestId !== latestLoadFileTreeRequestId || getCurrentVaultPath() !== basePath) {
            return;
          }

          if (shouldPreserveCurrentNoteInTree) {
            children = sortNestedFileTree(ensureFileNodeInTree(children, currentNote.path), {
              mode: fileTreeSortMode,
              metadata: initialMetadata,
            });
          }
        }

        const starredPaths = getVaultStarredPaths(get().starredEntries, basePath);

        const currentExpandedPaths = get().rootFolder && get().rootFolderPath === basePath
          ? collectExpandedPaths(get().rootFolder?.children ?? [])
          : null;
        const restoredChildren = skipRestore
          ? (currentExpandedPaths ? restoreExpandedState(children, currentExpandedPaths) : children)
          : (workspace?.expandedFolders?.length
              ? restoreExpandedState(children, new Set(workspace.expandedFolders))
              : children);

        if (requestId !== latestLoadFileTreeRequestId || getCurrentVaultPath() !== basePath) {
          return;
        }

        const currentMetadata = get().noteMetadata;
        const nextMetadata = mergeDraftMetadata(createEmptyMetadataFile(), currentMetadata);

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

        const restoreCandidatePaths = getWorkspaceRestoreCandidatePaths({
          currentNotePath: workspace?.currentNotePath,
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

        const treeStateBeforeBackgroundLoad = get();
        scheduleBackgroundFileTreeLoad(async () => {
          let nextBackgroundChildren = treeStateBeforeBackgroundLoad.rootFolder?.children ?? [];

          if (shouldBuildShallowInitialTree) {
            const fullChildren = await buildFileTree(basePath);
            if (requestId !== latestLoadFileTreeRequestId || getCurrentVaultPath() !== basePath) {
              return;
            }

            const currentState = get();
            const currentExpandedPaths = currentState.rootFolder && currentState.rootFolderPath === basePath
              ? collectExpandedPaths(currentState.rootFolder.children)
              : null;
            const backgroundExpandedPaths = getExpandedPathsForBackgroundTreeRestore(
              currentExpandedPaths,
              workspace?.expandedFolders,
              skipRestore,
            );
            nextBackgroundChildren = backgroundExpandedPaths
              ? restoreExpandedState(fullChildren, backgroundExpandedPaths)
              : fullChildren;

            const currentNote = currentState.currentNote;
            const currentTab = currentNote
              ? currentState.openTabs.find((tab) => tab.path === currentNote.path)
              : undefined;
            if (
              currentNote &&
              !isAbsolutePath(currentNote.path) &&
              !isDraftNotePath(currentNote.path) &&
              (currentState.isDirty || currentTab?.isDirty === true)
            ) {
              nextBackgroundChildren = ensureFileNodeInTree(nextBackgroundChildren, currentNote.path);
            }

            const sortedBackgroundChildren = sortNestedFileTree(nextBackgroundChildren, {
              mode: currentState.fileTreeSortMode,
              metadata: currentState.noteMetadata,
            });

            if (currentState.rootFolder && currentState.rootFolderPath === basePath) {
              set({
                rootFolder: {
                  ...currentState.rootFolder,
                  children: sortedBackgroundChildren,
                },
              });
            }
          }

          const metadataStateBeforeBackgroundLoad = get().noteMetadata;
          const metadata = await loadNoteMetadata(basePath);
          if (requestId !== latestLoadFileTreeRequestId || getCurrentVaultPath() !== basePath) {
            return;
          }
          if (get().noteMetadata !== metadataStateBeforeBackgroundLoad) {
            return;
          }

          const mergedMetadata = mergeDraftMetadata(metadata, get().noteMetadata);
          const currentState = get();
          const nextRootFolder = currentState.rootFolder && currentState.rootFolderPath === basePath
            ? {
                ...currentState.rootFolder,
                children: sortNestedFileTree(currentState.rootFolder.children, {
                  mode: currentState.fileTreeSortMode,
                  metadata: mergedMetadata,
                }),
              }
            : currentState.rootFolder;

          set({
            noteMetadata: mergedMetadata,
            ...(nextRootFolder ? { rootFolder: nextRootFolder } : {}),
          });
        });

        if (requestId === latestLoadFileTreeRequestId && getCurrentVaultPath() === basePath) {
          set({ isLoading: false });
        }
      } catch (error) {
        if (requestId === latestLoadFileTreeRequestId) {
          if (isNoVaultSelectedError(error)) {
            set({ error: null, isLoading: false });
            return;
          }
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
