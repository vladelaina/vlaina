import { isAbsolutePath } from '@/lib/storage/adapter';
import {
  buildFileTree,
  collectExpandedPaths,
  isGitRepositoryDirectory,
  restoreExpandedState,
} from '../fileTreeUtils';
import { ensureFileNodeInTree } from '../fileTreePreservation';
import { sortNestedFileTree } from '../fileTreeSorting';
import { isDraftNotePath } from '../draftNote';
import { loadNoteMetadata } from '../storage';
import {
  buildSortedRootFolder,
  shouldRebuildRootFolderForMetadataFileChange,
} from '../utils/fs/rootFolderState';
import type { FileSystemSliceGet, FileSystemSliceSet } from './fileSystemSliceContracts';
import { mergeDraftMetadata } from './fileSystemSliceTreeMetadata';
import type { FileTreeNode, FolderNode } from '../types';

const BACKGROUND_FILE_TREE_LOAD_DELAY_MS = 100;
const BACKGROUND_FILE_TREE_IDLE_TIMEOUT_MS = 1000;

function scheduleBackgroundFileTreeTask(task: () => void) {
  if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(() => task(), { timeout: BACKGROUND_FILE_TREE_IDLE_TIMEOUT_MS });
    return;
  }
  setTimeout(task, BACKGROUND_FILE_TREE_LOAD_DELAY_MS);
}

function collectTreeNotePaths(nodes: readonly FileTreeNode[]): string[] {
  const paths: string[] = [];
  const stack = [...nodes].reverse();
  while (stack.length > 0) {
    const node = stack.pop()!;
    if (node.isFolder) {
      for (let index = node.children.length - 1; index >= 0; index -= 1) {
        stack.push(node.children[index]!);
      }
    } else if (node.kind !== 'image') {
      paths.push(node.path);
    }
  }
  return paths;
}

function applyRootGitRepositoryState(
  rootFolder: FolderNode | null,
  isGitRepository: boolean,
): FolderNode | null {
  if (!rootFolder || Boolean(rootFolder.isGitRepository) === isGitRepository) {
    return rootFolder;
  }
  return {
    ...rootFolder,
    isGitRepository: isGitRepository || undefined,
  };
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

export function scheduleLoadFileTreeBackgroundRefresh({
  basePath,
  requestId,
  skipRestore,
  shouldBuildShallowInitialTree,
  workspaceExpandedFolders,
  get,
  set,
  isCurrentRequest,
}: {
  basePath: string;
  requestId: number;
  skipRestore: boolean;
  shouldBuildShallowInitialTree: boolean;
  workspaceExpandedFolders?: string[];
  get: FileSystemSliceGet;
  set: FileSystemSliceSet;
  isCurrentRequest: (requestId: number, basePath: string) => boolean;
}) {
  scheduleBackgroundFileTreeTask(() => {
    void (async () => {
      const metadataStateBeforeBackgroundLoad = get().noteMetadata;
      const rootGitRepositoryPromise = isGitRepositoryDirectory(basePath);
      let knownNotePaths: string[] | undefined;
      let nextBackgroundChildren = get().rootFolder?.children ?? [];

      if (shouldBuildShallowInitialTree) {
        const fullChildren = await buildFileTree(basePath);
        knownNotePaths = collectTreeNotePaths(fullChildren);
        if (!isCurrentRequest(requestId, basePath)) {
          return;
        }

        const isRootGitRepository = await rootGitRepositoryPromise;
        if (!isCurrentRequest(requestId, basePath)) {
          return;
        }
        const currentState = get();
        const currentExpandedPaths = currentState.rootFolder && currentState.rootFolderPath === basePath
          ? collectExpandedPaths(currentState.rootFolder.children)
          : null;
        const backgroundExpandedPaths = getExpandedPathsForBackgroundTreeRestore(
          currentExpandedPaths,
          workspaceExpandedFolders,
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
          const rootWithGitState = applyRootGitRepositoryState(
            currentState.rootFolder,
            isRootGitRepository,
          );
          const nextRootFolder = buildSortedRootFolder(
            rootWithGitState,
            sortedBackgroundChildren,
            currentState.fileTreeSortMode,
            currentState.noteMetadata,
          );
          if (nextRootFolder !== currentState.rootFolder) {
            set({
              rootFolder: nextRootFolder,
            });
          }
        }
      }

      const metadata = await loadNoteMetadata(basePath, knownNotePaths);
      if (!isCurrentRequest(requestId, basePath)) {
        return;
      }
      if (get().noteMetadata !== metadataStateBeforeBackgroundLoad) {
        return;
      }

      const isRootGitRepository = await rootGitRepositoryPromise;
      if (!isCurrentRequest(requestId, basePath)) {
        return;
      }
      if (get().noteMetadata !== metadataStateBeforeBackgroundLoad) {
        return;
      }

      const mergedMetadata = mergeDraftMetadata(metadata, get().noteMetadata);
      const currentState = get();
      const rootWithGitState = currentState.rootFolderPath === basePath
        ? applyRootGitRepositoryState(currentState.rootFolder, isRootGitRepository)
        : currentState.rootFolder;
      const shouldRebuildRootFolder =
        currentState.rootFolderPath === basePath &&
        (
          rootWithGitState !== currentState.rootFolder ||
          shouldRebuildRootFolderForMetadataFileChange(
            currentState.fileTreeSortMode,
            currentState.rootFolder,
            currentState.noteMetadata,
            mergedMetadata,
          )
        );
      const nextRootFolder = shouldRebuildRootFolder
        ? buildSortedRootFolder(
            rootWithGitState,
            rootWithGitState?.children ?? [],
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
    })().catch(() => undefined);
  });
}
