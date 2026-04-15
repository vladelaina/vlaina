import type { DraftNoteEntry, NoteMetadataEntry } from './types';

export const DRAFT_NOTE_PATH_PREFIX = 'draft:';

export function createDraftNotePath(): string {
  return `${DRAFT_NOTE_PATH_PREFIX}${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function isDraftNotePath(path: string | null | undefined): path is string {
  return Boolean(path && path.startsWith(DRAFT_NOTE_PATH_PREFIX));
}

export function resolveDraftNoteTitle(name: string | null | undefined): string {
  const trimmedName = name?.trim();
  return trimmedName || 'Untitled';
}

export function isDraftNoteEmpty(content: string | null | undefined): boolean {
  const trimmedContent = content?.trim() ?? '';
  return trimmedContent.length === 0 || trimmedContent === '#';
}

export function hasDraftUnsavedChanges({
  draftName,
  content,
  metadata,
}: {
  draftName: string | null | undefined;
  content: string | null | undefined;
  metadata?: NoteMetadataEntry;
}): boolean {
  const hasDraftTitle = Boolean(draftName?.trim());
  const hasDraftMetadata = Boolean(metadata && Object.keys(metadata).length > 0);

  return hasDraftTitle || !isDraftNoteEmpty(content) || hasDraftMetadata;
}

export function getDraftNoteEntry(
  draftNotes: Record<string, DraftNoteEntry>,
  path: string | null | undefined,
): DraftNoteEntry | null {
  if (!path || !isDraftNotePath(path)) {
    return null;
  }

  return draftNotes[path] ?? null;
}
