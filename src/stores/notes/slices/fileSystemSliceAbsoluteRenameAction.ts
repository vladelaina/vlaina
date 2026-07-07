import {
  getBaseName,
  getParentPath,
  getStorageAdapter,
  isAbsolutePath,
  normalizeAbsolutePath,
  relativePath,
} from '@/lib/storage/adapter';
import { getNoteTitleFromPath } from '@/lib/notes/displayName';
import { resolveUniqueRenamedPath } from '../utils/fs/pathOperations';
import { markExpectedExternalChange } from '../document/externalChangeRegistry';
import { emitNotesExternalPathRename } from '../document/externalPathBroadcast';
import { remapMetadataEntries } from '../storage';
import {
  getStarredEntryAbsolutePath,
  getStarredNotesRootPathComparisonKey,
  getNotesRootStarredPaths,
  normalizeStarredRelativePath,
  saveStarredRegistry,
} from '../starred';
import { assertValidFileName } from '../noteUtils';
import { hasInternalNotePathSegment } from '../utils/fs/internalNotePaths';
import { hasUnsafeNotesRootPathSegment } from '../utils/fs/notesRootPathContainment';
import {
  remapOpenTabsForExternalRename,
} from '../document/externalPathSync';
import { remapNoteNavigationHistoryForExternalRename } from '../document/noteNavigationHistory';
import { applyPathRenameState } from './fileSystemSliceHelpers';
import { flushCurrentPendingEditorMarkdown } from '../pendingEditorMarkdownFlusher';
import { isActiveNotesPath } from './fileSystemSliceRenameShared';
import type { FileSystemSliceGet, FileSystemSliceSet } from './fileSystemSliceContracts';

export async function renameAbsoluteNoteAction(
  set: FileSystemSliceSet,
  get: FileSystemSliceGet,
  path: string,
  newName: string,
): Promise<void> {
  flushCurrentPendingEditorMarkdown();
  const {
    notesPath,
    noteMetadata,
  } = get();

  try {
    assertValidFileName(newName);
    if (!isAbsolutePath(path)) {
      await get().renameNote(path, newName);
      return;
    }
    if (hasInternalNotePathSegment(path)) {
      throw new Error('Path must not be inside an internal notes folder.');
    }
    if (hasUnsafeNotesRootPathSegment(normalizeAbsolutePath(path))) {
      throw new Error('Selected file path contains unsupported characters');
    }

    const normalizedPath = normalizeAbsolutePath(path);
    const parentPath = getParentPath(normalizedPath);
    if (!parentPath) {
      return;
    }

    const currentFileName = getBaseName(normalizedPath);
    const {
      relativePath: newFileName,
      fullPath: newPath,
    } = await resolveUniqueRenamedPath(parentPath, currentFileName, newName, false);
    if (newPath === normalizedPath) {
      return;
    }

    const nextTitle = getNoteTitleFromPath(newFileName);
    const storage = getStorageAdapter();
    markExpectedExternalChange(normalizedPath);
    markExpectedExternalChange(newPath);
    await storage.rename(normalizedPath, newPath);
    if (!isActiveNotesPath(get, notesPath)) {
      return;
    }
    emitNotesExternalPathRename({ notesPath: parentPath, oldPath: normalizedPath, newPath });

    let starredChanged = false;
    const normalizedOldPath = normalizedPath.replace(/\\/g, '/');
    const latestState = get();
    const updatedStarredEntries = latestState.starredEntries.map((entry) => {
      if (entry.kind !== 'note') {
        return entry;
      }

      const entryAbsolutePath = getStarredEntryAbsolutePath(entry);
      if (
        !entryAbsolutePath ||
        getStarredNotesRootPathComparisonKey(entryAbsolutePath) !== getStarredNotesRootPathComparisonKey(normalizedOldPath)
      ) {
        return entry;
      }

      const nextRelativePath = normalizeStarredRelativePath(relativePath(entry.notesRootPath, newPath));
      if (!nextRelativePath || nextRelativePath === entry.relativePath) {
        return entry;
      }

      starredChanged = true;
      return { ...entry, relativePath: nextRelativePath };
    });
    if (starredChanged) {
      void Promise.resolve(saveStarredRegistry(updatedStarredEntries)).catch(() => undefined);
    }

    const updatedTabs = remapOpenTabsForExternalRename(latestState.openTabs, normalizedPath, newPath).map((tab) =>
      tab.path === newPath ? { ...tab, name: nextTitle } : tab
    );
    const updatedMetadata = remapMetadataEntries(latestState.noteMetadata ?? noteMetadata, (metadataPath) =>
      metadataPath === normalizedPath ? newPath : metadataPath
    );
    const { nextRecentNotes, nextDisplayNames, nextNoteContentsCache } = applyPathRenameState({
      oldPath: normalizedPath,
      newPath,
      recentNotes: latestState.recentNotes,
      displayNames: latestState.displayNames,
      noteContentsCache: latestState.noteContentsCache,
    });
    nextDisplayNames.set(newPath, nextTitle);

    const starredPaths = getNotesRootStarredPaths(updatedStarredEntries, notesPath);
    const nextCurrentNote = latestState.currentNote?.path === normalizedPath
      ? { ...latestState.currentNote, path: newPath }
      : latestState.currentNote;
    set({
      starredEntries: updatedStarredEntries,
      starredNotes: starredPaths.notes,
      starredFolders: starredPaths.folders,
      noteMetadata: updatedMetadata,
      openTabs: updatedTabs,
      currentNote: nextCurrentNote,
      currentNoteRevision:
        latestState.currentNote?.path === normalizedPath
          ? latestState.currentNoteRevision + 1
          : latestState.currentNoteRevision,
      recentNotes: nextRecentNotes,
      displayNames: nextDisplayNames,
      noteContentsCache: nextNoteContentsCache,
      ...remapNoteNavigationHistoryForExternalRename(
        latestState.noteNavigationHistory,
        latestState.noteNavigationHistoryIndex,
        normalizedPath,
        newPath,
      ),
    });
  } catch (error) {
    if (notesPath && !isActiveNotesPath(get, notesPath)) {
      return;
    }
    set({ error: error instanceof Error ? error.message : 'Failed to rename note' });
  }
}
