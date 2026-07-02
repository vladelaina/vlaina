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
  getCurrentNotesRootPath,
  getNotesBasePath,
  loadNoteMetadata,
  loadWorkspaceState,
} from '../storage';
import { getNotesRootStarredPaths } from '../starred';
import { hasInternalNotePathSegment } from '../utils/fs/internalNotePaths';
import { normalizeNotesRootRelativePath, resolveNotesRootRelativeFullPath } from '../utils/fs/notesRootPathContainment';
import {
  areRootFoldersEquivalent,
  buildSortedRootFolder,
  shouldRebuildRootFolderForMetadataFileChange,
} from '../utils/fs/rootFolderState';
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
    const normalizedPath = normalizeNotesRootRelativePath(candidate);
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

function isNoNotesRootSelectedError(error: unknown): boolean {
  return error instanceof Error && error.message === 'No opened folder selected';
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
        if (requestId !== latestLoadFileTreeRequestId || getCurrentNotesRootPath() !== basePath) {
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
              const { fullPath } = await resolveNotesRootRelativeFullPath(basePath, currentNote.path);
              shouldPreserveCurrentNoteInTree = await storage.exists(fullPath);
            } catch {
              shouldPreserveCurrentNoteInTree = false;
            }
          }

          if (requestId !== latestLoadFileTreeRequestId || getCurrentNotesRootPath() !== basePath) {
            return;
          }

          if (shouldPreserveCurrentNoteInTree) {
            children = sortNestedFileTree(ensureFileNodeInTree(children, currentNote.path), {
              mode: fileTreeSortMode,
              metadata: initialMetadata,
            });
          }
        }

        const starredPaths = getNotesRootStarredPaths(get().starredEntries, basePath);

        const currentExpandedPaths = get().rootFolder && get().rootFolderPath === basePath
          ? collectExpandedPaths(get().rootFolder?.children ?? [])
          : null;
        const restoredChildren = skipRestore
          ? (currentExpandedPaths ? restoreExpandedState(children, currentExpandedPaths) : children)
          : (workspace?.expandedFolders?.length
              ? restoreExpandedState(children, new Set(workspace.expandedFolders))
              : children);

        if (requestId !== latestLoadFileTreeRequestId || getCurrentNotesRootPath() !== basePath) {
          return;
        }

        const currentStateBeforeTreeCommit = get();
        const currentMetadata = currentStateBeforeTreeCommit.noteMetadata;
        const nextMetadata = mergeDraftMetadata(createEmptyMetadataFile(), currentMetadata);
        const candidateRootFolder = {
          id: '',
          name: 'Notes',
          path: '',
          isFolder: true as const,
          children: restoredChildren,
          expanded: true,
          ...(isRootGitRepository ? { isGitRepository: true } : {}),
        };
        const nextRootFolder =
          currentStateBeforeTreeCommit.rootFolderPath === basePath &&
          areRootFoldersEquivalent(currentStateBeforeTreeCommit.rootFolder, candidateRootFolder)
            ? currentStateBeforeTreeCommit.rootFolder
            : candidateRootFolder;

        set({
          notesPath: basePath,
          rootFolderPath: basePath,
          rootFolder: nextRootFolder,
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
              const { relativePath, fullPath } = await resolveNotesRootRelativeFullPath(basePath, candidatePath);
              if (
                requestId === latestLoadFileTreeRequestId &&
                getCurrentNotesRootPath() === basePath &&
                await storage.exists(fullPath)
              ) {
                await get().openNote(relativePath, false, { restoredFromWorkspace: true });
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
            if (requestId !== latestLoadFileTreeRequestId || getCurrentNotesRootPath() !== basePath) {
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
              const nextRootFolder = buildSortedRootFolder(
                currentState.rootFolder,
                sortedBackgroundChildren,
                currentState.fileTreeSortMode,
                currentState.noteMetadata,
              );
              if (nextRootFolder === currentState.rootFolder) {
                return;
              }

              set({
                rootFolder: nextRootFolder,
              });
            }
          }

          const metadataStateBeforeBackgroundLoad = get().noteMetadata;
          const metadata = await loadNoteMetadata(basePath);
          if (requestId !== latestLoadFileTreeRequestId || getCurrentNotesRootPath() !== basePath) {
            return;
          }
          if (get().noteMetadata !== metadataStateBeforeBackgroundLoad) {
            return;
          }

          const mergedMetadata = mergeDraftMetadata(metadata, get().noteMetadata);
          const currentState = get();
          const shouldRebuildRootFolder =
            currentState.rootFolderPath === basePath &&
            shouldRebuildRootFolderForMetadataFileChange(
              currentState.fileTreeSortMode,
              currentState.rootFolder,
              currentState.noteMetadata,
              mergedMetadata,
            );
          const nextRootFolder = shouldRebuildRootFolder
            ? buildSortedRootFolder(
                currentState.rootFolder,
                currentState.rootFolder?.children ?? [],
                currentState.fileTreeSortMode,
                mergedMetadata,
              )
            : currentState.rootFolder;

          set({
            noteMetadata: mergedMetadata,
            ...(nextRootFolder && nextRootFolder !== currentState.rootFolder
              ? { rootFolder: nextRootFolder }
              : {}),
          });
        });

        if (requestId === latestLoadFileTreeRequestId && getCurrentNotesRootPath() === basePath) {
          set({ isLoading: false });
        }
      } catch (error) {
        if (requestId === latestLoadFileTreeRequestId) {
          if (isNoNotesRootSelectedError(error)) {
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
