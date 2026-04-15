import { isAbsolutePath } from '@/lib/storage/adapter';
import { getDraftNoteEntry, isDraftNotePath } from './draftNote';
import type { DraftNoteEntry } from './types';

export type NotePathKind = 'draft' | 'vault' | 'external' | 'none';

export function getNotePathKind(path: string | null | undefined): NotePathKind {
  if (!path) {
    return 'none';
  }

  if (isDraftNotePath(path)) {
    return 'draft';
  }

  return isAbsolutePath(path) ? 'external' : 'vault';
}

export function isVaultNotePath(path: string | null | undefined): path is string {
  return getNotePathKind(path) === 'vault';
}

export function canStarNotePath(path: string | null | undefined): path is string {
  return isVaultNotePath(path);
}

export function getVaultNoteParentPath(path: string | null | undefined): string | undefined {
  if (!isVaultNotePath(path) || !path.includes('/')) {
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

  return getVaultNoteParentPath(currentPath);
}
