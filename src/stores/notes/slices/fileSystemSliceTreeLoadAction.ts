import { getStorageAdapter, isAbsolutePath } from '@/lib/storage/adapter';
import { isSupportedMarkdownPath } from '@/lib/notes/markdownFile';
import {
  buildFileTree,
  buildFileTreeLevel,
  INITIAL_FILE_TREE_ENTRY_LIMIT,
  collectExpandedPaths,
  restoreExpandedState,
} from '../fileTreeUtils';
import { ensureFileNodeInTree } from '../fileTreePreservation';
import { DEFAULT_FILE_TREE_SORT_MODE, sortNestedFileTree } from '../fileTreeSorting';
import { isDraftNotePath } from '../draftNote';
import {
  ensureNotesFolder,
  createEmptyMetadataFile,
  getCurrentNotesRootPath,
  getNotesBasePath,
  loadWorkspaceState,
} from '../storage';
import { getNotesRootStarredPaths } from '../starred';
import { hasInternalNotePathSegment } from '../utils/fs/internalNotePaths';
import { normalizeNotesRootRelativePath, resolveNotesRootRelativeFullPath } from '../utils/fs/notesRootPathContainment';
import {
  areRootFoldersEquivalent,
} from '../utils/fs/rootFolderState';
import type { FileSystemSlice, FileSystemSliceGet, FileSystemSliceSet } from './fileSystemSliceContracts';
import { scheduleLoadFileTreeBackgroundRefresh } from './fileSystemSliceTreeBackgroundLoad';
import { mergeDraftMetadata } from './fileSystemSliceTreeMetadata';

let latestLoadFileTreeRequestId = 0;

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

function isCurrentFileTreeLoadRequest(requestId: number, basePath: string) {
  return requestId === latestLoadFileTreeRequestId && getCurrentNotesRootPath() === basePath;
}

export function invalidatePendingFileTreeLoads() {
  latestLoadFileTreeRequestId += 1;
}

export function createLoadFileTreeAction(
  set: FileSystemSliceSet,
  get: FileSystemSliceGet,
): FileSystemSlice['loadFileTree'] {
  return async (skipRestore = false) => {
    const requestId = ++latestLoadFileTreeRequestId;
    set({ error: null });
    try {
      const storage = getStorageAdapter();
      const basePath = await getNotesBasePath();

      const workspacePromise = loadWorkspaceState(basePath);
      await ensureNotesFolder(basePath);
      const workspace = await workspacePromise;

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
        ? await buildFileTreeLevel(basePath, '', undefined, {
            detectGitRepositories: false,
            maxEntries: INITIAL_FILE_TREE_ENTRY_LIMIT,
          })
        : await buildFileTree(basePath);

      const initialMetadata = mergeDraftMetadata(createEmptyMetadataFile(), get().noteMetadata);

      let children = sortNestedFileTree(builtChildren, {
        mode: fileTreeSortMode,
        metadata: initialMetadata,
      });
      if (!isCurrentFileTreeLoadRequest(requestId, basePath)) {
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

        if (!isCurrentFileTreeLoadRequest(requestId, basePath)) {
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

      if (!isCurrentFileTreeLoadRequest(requestId, basePath)) {
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
        ...(currentStateBeforeTreeCommit.rootFolderPath === basePath &&
        currentStateBeforeTreeCommit.rootFolder?.isGitRepository
          ? { isGitRepository: true as const }
          : {}),
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
        isLoading: false,
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
              isCurrentFileTreeLoadRequest(requestId, basePath) &&
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

      scheduleLoadFileTreeBackgroundRefresh({
        basePath,
        requestId,
        skipRestore,
        shouldBuildShallowInitialTree,
        workspaceExpandedFolders: workspace?.expandedFolders,
        get,
        set,
        isCurrentRequest: isCurrentFileTreeLoadRequest,
      });
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
  };
}
