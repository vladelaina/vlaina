import { isSupportedMarkdownPath } from '@/lib/notes/markdownFile';
import { isAbsolutePath, normalizeAbsolutePath } from '@/lib/storage/adapter';
import {
  remapCurrentNoteForExternalRename,
  remapDisplayNamesForExternalRename,
  remapOpenTabsForExternalRename,
  remapRecentNotesForExternalRename,
} from '../document/externalPathSync';
import { remapNoteNavigationHistoryForExternalRename } from '../document/noteNavigationHistory';
import {
  remapCachedNoteContents,
} from '../document/noteContentCache';
import { remapMetadataEntries } from '../storage';
import { normalizeNotesRootRelativePath } from '../utils/fs/notesRootPathContainment';
import type { NotesGet, NotesSet, WorkspaceSlice } from './workspaceSliceTypes';
import { isInternalWorkspaceNotePath } from './workspaceOpenNoteSupport';

export function createWorkspaceAdoptAbsoluteNoteAction(
  set: NotesSet,
  get: NotesGet,
): Pick<WorkspaceSlice, 'adoptAbsoluteNoteIntoNotesRoot'> {
  return {
    adoptAbsoluteNoteIntoNotesRoot: (absolutePath: string, nextPath: string) => {
      const {
        currentNote,
        openTabs,
        noteContentsCache,
        noteMetadata,
        displayNames,
        recentNotes,
        noteNavigationHistory,
        noteNavigationHistoryIndex,
      } = get();
      const normalizedAbsolutePath = normalizeAbsolutePath(absolutePath);
      if (!isAbsolutePath(normalizedAbsolutePath) || currentNote?.path !== normalizedAbsolutePath) {
        return false;
      }
      if (!isSupportedMarkdownPath(nextPath)) {
        return false;
      }
      const normalizedNextPath = normalizeNotesRootRelativePath(nextPath);
      if (normalizedNextPath == null || isInternalWorkspaceNotePath(normalizedNextPath)) {
        return false;
      }

      set({
        currentNote: remapCurrentNoteForExternalRename(currentNote, normalizedAbsolutePath, normalizedNextPath),
        currentNoteRevision: get().currentNoteRevision + 1,
        openTabs: remapOpenTabsForExternalRename(openTabs, normalizedAbsolutePath, normalizedNextPath),
        noteContentsCache: remapCachedNoteContents(noteContentsCache, (path) =>
          path === normalizedAbsolutePath ? normalizedNextPath : path
        ),
        noteMetadata: remapMetadataEntries(noteMetadata, (path) =>
          path === normalizedAbsolutePath ? normalizedNextPath : path
        ),
        displayNames: remapDisplayNamesForExternalRename(displayNames, normalizedAbsolutePath, normalizedNextPath),
        recentNotes: remapRecentNotesForExternalRename(recentNotes, normalizedAbsolutePath, normalizedNextPath),
        ...remapNoteNavigationHistoryForExternalRename(
          noteNavigationHistory,
          noteNavigationHistoryIndex,
          normalizedAbsolutePath,
          normalizedNextPath,
        ),
      });
      return true;
    },
  };
}
