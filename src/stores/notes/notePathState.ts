import { isAbsolutePath } from '@/lib/storage/adapter';
import { getDraftNoteEntry, isDraftNotePath } from './draftNote';
import { resolveStarredRelativePathForNotesRoot } from './starred';
import type { DraftNoteEntry } from './types';

export type NotePathKind = 'draft' | 'notesRoot' | 'external' | 'none';

export function getNotePathKind(path: string | null | undefined): NotePathKind {
  if (!path) {
    return 'none';
  }

  if (isDraftNotePath(path)) {
    return 'draft';
  }

  return isAbsolutePath(path) ? 'external' : 'notesRoot';
}

export function isNotesRootNotePath(path: string | null | undefined): path is string {
  return getNotePathKind(path) === 'notesRoot';
}

export function canStarNotePath(
  path: string | null | undefined,
  notesPath?: string,
): path is string {
  if (isNotesRootNotePath(path)) {
    return true;
  }

  if (path && isAbsolutePath(path)) {
    return true;
  }

  return Boolean(path && notesPath && resolveStarredRelativePathForNotesRoot(path, notesPath));
}

export function getNotesRootNoteParentPath(path: string | null | undefined): string | undefined {
  if (!isNotesRootNotePath(path) || !path.includes('/')) {
    return undefined;
  }

  return path.substring(0, path.lastIndexOf('/')) || undefined;
}

export function resolveSiblingNoteParentPath(
  draftNotes: Record<string, DraftNoteEntry>,
  currentPath: string | null | undefined,
): string | undefined {
  const draftNote = getDraftNoteEntry(draftNotes, currentPath);
  if (draftNote) {
    return draftNote.parentPath ?? undefined;
  }

  return getNotesRootNoteParentPath(currentPath);
}
