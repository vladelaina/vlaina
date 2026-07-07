import { isAbsolutePath } from '@/lib/storage/adapter';
import {
  buildFileTree,
  collectExpandedPaths,
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

const BACKGROUND_FILE_TREE_LOAD_DELAY_MS = 100;

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
  setTimeout(() => {
    void (async () => {
      let nextBackgroundChildren = get().rootFolder?.children ?? [];

      if (shouldBuildShallowInitialTree) {
        const fullChildren = await buildFileTree(basePath);
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
      if (!isCurrentRequest(requestId, basePath)) {
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
    })().catch(() => undefined);
  }, BACKGROUND_FILE_TREE_LOAD_DELAY_MS);
}
