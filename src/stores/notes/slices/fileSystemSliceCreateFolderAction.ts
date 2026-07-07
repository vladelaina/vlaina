import { getStorageAdapter } from '@/lib/storage/adapter';
import { addNodeToTree } from '../fileTreeUtils';
import { ensureNotesFolder } from '../storage';
import { resolveUniquePath } from '../utils/fs/pathOperations';
import { buildSortedRootFolder } from '../utils/fs/rootFolderState';
import { markExpectedExternalChange } from '../document/externalChangeRegistry';
import { persistWorkspaceSnapshot } from '../workspacePersistence';
import { ensureRootFolderState } from './fileSystemSliceHelpers';
import type { FileSystemSlice, FileSystemSliceGet, FileSystemSliceSet } from './fileSystemSliceContracts';
import {
  getCurrentNotesRootPathForCreate,
  isActiveNotesPath,
} from './fileSystemSliceCreateShared';

export function createCreateFolderAction(
  set: FileSystemSliceSet,
  get: FileSystemSliceGet,
): FileSystemSlice['createFolder'] {
  return async (parentPath: string, name?: string) => {
    let {
      notesPath,
      fileTreeSortMode,
      noteMetadata,
    } = get();
    const storage = getStorageAdapter();

    try {
      if (!notesPath) {
        const currentNotesRootPath = getCurrentNotesRootPathForCreate();
        if (!currentNotesRootPath) {
          return null;
        }

        notesPath = currentNotesRootPath;
        await ensureNotesFolder(notesPath);
        set({ notesPath });
      }

      const { relativePath, fullPath, fileName } = await resolveUniquePath(
        notesPath,
        parentPath || undefined,
        name || 'Untitled',
        true,
      );

      markExpectedExternalChange(fullPath, true);
      await storage.mkdir(fullPath, true);
      if (!isActiveNotesPath(get, notesPath)) {
        return relativePath;
      }

      const latestState = get();
      const latestRootFolder = ensureRootFolderState(latestState.rootFolder);
      const latestSortMode = latestState.fileTreeSortMode ?? fileTreeSortMode;
      const nextRootFolder = buildSortedRootFolder(
        latestRootFolder,
        addNodeToTree(latestRootFolder.children, parentPath, {
          id: relativePath,
          name: fileName,
          path: relativePath,
          isFolder: true,
          children: [],
          expanded: false,
        }),
        latestSortMode,
        latestState.noteMetadata ?? noteMetadata,
      );

      set({
        rootFolder: nextRootFolder,
        newlyCreatedFolderPath: !name ? relativePath : null,
      });
      persistWorkspaceSnapshot(notesPath, {
        rootFolder: nextRootFolder,
        currentNotePath: latestState.currentNote?.path ?? null,
        fileTreeSortMode: latestSortMode,
      });
      return relativePath;
    } catch (error) {
      if (notesPath && !isActiveNotesPath(get, notesPath)) {
        return null;
      }
      set({ error: error instanceof Error ? error.message : 'Failed to create folder' });
      return null;
    }
  };
}
