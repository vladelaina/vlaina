import type { NotesStore } from '../../types';
import { remapCachedNoteContents } from '../../document/noteContentCache';
import {
  pruneDisplayNamesForExternalDeletion,
  pruneRecentNotesForExternalDeletion,
  remapDisplayNamesForExternalRename,
  remapPathForExternalRename,
  remapRecentNotesForExternalRename,
} from '../../document/externalPathSync';

interface PathRenameStateInput {
  oldPath: string;
  newPath: string;
  recentNotes: NotesStore['recentNotes'];
  displayNames: NotesStore['displayNames'];
  noteContentsCache: NotesStore['noteContentsCache'];
}

interface PathDeletionStateInput {
  path: string;
  recentNotes: NotesStore['recentNotes'];
  displayNames: NotesStore['displayNames'];
  noteContentsCache: NotesStore['noteContentsCache'];
}

export function getStateForPathRename({
  oldPath,
  newPath,
  recentNotes,
  displayNames,
  noteContentsCache,
}: PathRenameStateInput) {
  const nextRecentNotes = remapRecentNotesForExternalRename(recentNotes, oldPath, newPath);
  const nextDisplayNames = remapDisplayNamesForExternalRename(displayNames, oldPath, newPath);
  const nextNoteContentsCache = remapCachedNoteContents(noteContentsCache, (cachedPath) =>
    remapPathForExternalRename(cachedPath, oldPath, newPath)
  );

  return {
    nextRecentNotes,
    nextDisplayNames,
    nextNoteContentsCache,
  };
}

export function getStateForPathDeletion({
  path,
  recentNotes,
  displayNames,
  noteContentsCache,
}: PathDeletionStateInput) {
  const nextRecentNotes = pruneRecentNotesForExternalDeletion(recentNotes, path);
  const nextDisplayNames = pruneDisplayNamesForExternalDeletion(displayNames, path);
  const nextNoteContentsCache = remapCachedNoteContents(noteContentsCache, (cachedPath) =>
    cachedPath === path || cachedPath.startsWith(`${path}/`) ? null : cachedPath
  );

  return {
    nextRecentNotes,
    nextDisplayNames,
    nextNoteContentsCache,
  };
}
