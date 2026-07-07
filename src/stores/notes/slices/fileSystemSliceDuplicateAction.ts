import { getNoteTitleFromPath } from '@/lib/notes/displayName';
import { isSupportedMarkdownPath } from '@/lib/notes/markdownFile';
import { getStorageAdapter } from '@/lib/storage/adapter';
import { addNodeToTree } from '../fileTreeUtils';
import {
  createEmptyMetadataFile,
  ensureNotesFolder,
  mergeNoteMetadataWithFileInfo,
  setNoteEntry,
} from '../storage';
import { getParentPath, resolveUniquePath } from '../utils/fs/pathOperations';
import { resolveNotesRootRelativeFullPath } from '../utils/fs/notesRootPathContainment';
import { hasInternalNotePathSegment } from '../utils/fs/internalNotePaths';
import { buildSortedRootFolder } from '../utils/fs/rootFolderState';
import { markExpectedExternalChange } from '../document/externalChangeRegistry';
import { persistWorkspaceSnapshot } from '../workspacePersistence';
import { ensureRootFolderState } from './fileSystemSliceHelpers';
import type { FileSystemSlice } from './fileSystemSliceContracts';
import type { FileSystemSliceGet, FileSystemSliceSet } from './fileSystemSliceContracts';
import {
  ensureCurrentNoteSaved,
  getCurrentNotesRootPathForCreate,
  isActiveNotesPath,
} from './fileSystemSliceCreateShared';

export function createDuplicateNoteAction(
  set: FileSystemSliceSet,
  get: FileSystemSliceGet,
): FileSystemSlice['duplicateNote'] {
  return async (path: string) => {
    let notesPathForError = '';
    try {
      let {
        notesPath,
        rootFolder,
        fileTreeSortMode,
      } = await ensureCurrentNoteSaved(get, { skipDraft: true });
      notesPathForError = notesPath;

      if (!notesPath) {
        const currentNotesRootPath = getCurrentNotesRootPathForCreate();
        if (!currentNotesRootPath) {
          throw new Error('Notes path is not available');
        }

        notesPath = currentNotesRootPath;
        notesPathForError = notesPath;
        await ensureNotesFolder(notesPath);
        set({ notesPath });
      }

      const storage = getStorageAdapter();
      const { relativePath: sourcePath, fullPath: sourceFullPath } =
        await resolveNotesRootRelativeFullPath(notesPath, path);
      if (!isSupportedMarkdownPath(sourcePath)) {
        throw new Error('Only Markdown files can be duplicated as notes.');
      }
      if (hasInternalNotePathSegment(sourcePath)) {
        throw new Error('Path must not be inside an internal notes folder.');
      }

      const sourceName = sourcePath.split('/').filter(Boolean).pop() || 'Untitled.md';
      const parentPath = getParentPath(sourcePath) || undefined;
      const {
        relativePath: duplicatePath,
        fullPath: duplicateFullPath,
        fileName,
      } = await resolveUniquePath(notesPath, parentPath, sourceName, false);

      markExpectedExternalChange(duplicateFullPath);
      await storage.copyFile(sourceFullPath, duplicateFullPath);
      if (!isActiveNotesPath(get, notesPath)) {
        return duplicatePath;
      }

      const duplicateFileInfo = await storage.stat(duplicateFullPath).catch(() => null);
      if (!isActiveNotesPath(get, notesPath)) {
        return duplicatePath;
      }

      const duplicateTitle = getNoteTitleFromPath(fileName);
      const latestState = get();
      const duplicateMetadata = mergeNoteMetadataWithFileInfo(
        latestState.noteMetadata?.notes[sourcePath],
        duplicateFileInfo,
      );
      const latestRootFolder = ensureRootFolderState(latestState.rootFolder ?? rootFolder);
      const latestMetadata = setNoteEntry(
        latestState.noteMetadata ?? createEmptyMetadataFile(),
        duplicatePath,
        duplicateMetadata,
      );
      const latestSortMode = latestState.fileTreeSortMode ?? fileTreeSortMode;
      const nextRootFolder = buildSortedRootFolder(
        latestRootFolder,
        addNodeToTree(latestRootFolder.children, parentPath, {
          id: duplicatePath,
          name: duplicateTitle,
          path: duplicatePath,
          isFolder: false,
        }),
        latestSortMode,
        latestMetadata,
      );

      set({
        rootFolder: nextRootFolder,
        noteMetadata: latestMetadata,
        isNewlyCreated: false,
        error: null,
      });

      persistWorkspaceSnapshot(notesPath, {
        rootFolder: nextRootFolder,
        currentNotePath: latestState.currentNote?.path ?? null,
        fileTreeSortMode: latestSortMode,
      });

      return duplicatePath;
    } catch (error) {
      if (notesPathForError && !isActiveNotesPath(get, notesPathForError)) {
        throw error;
      }
      set({ error: error instanceof Error ? error.message : 'Failed to duplicate note' });
      throw error;
    }
  };
}
