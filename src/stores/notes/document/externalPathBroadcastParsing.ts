import { normalizeNotePathKey } from '@/lib/notes/displayName';
import { normalizeContainedAssetPath } from '@/lib/assets/core/pathContainment';
import { isAbsolutePath } from '@/lib/storage/adapter';
import { hasUnsafeNotesRootPathSegment, normalizeNotesRootRelativePath } from '../utils/fs/notesRootPathContainment';
import { hasInternalNotePathSegment } from '../utils/fs/internalNotePaths';

export interface NotesExternalPathRenameEvent {
  type: 'rename';
  sourceId: string;
  nonce: string;
  stamp: number;
  notesPath: string;
  oldPath: string;
  newPath: string;
}

export const MAX_EVENT_FILE_BYTES = 256 * 1024;

const MAX_EVENT_STRING_LENGTH = 4096;
const CONTROL_OR_BIDI_PATTERN = /[\u0000-\u001F\u007F\u202A-\u202E\u2066-\u2069\uFFFD]/;

export function parseRenameEvent(value: unknown): NotesExternalPathRenameEvent | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const event = value as Partial<NotesExternalPathRenameEvent>;
  if (
    event.type !== 'rename' ||
    typeof event.sourceId !== 'string' ||
    typeof event.nonce !== 'string' ||
    typeof event.stamp !== 'number' ||
    !Number.isFinite(event.stamp) ||
    typeof event.notesPath !== 'string' ||
    typeof event.oldPath !== 'string' ||
    typeof event.newPath !== 'string'
  ) {
    return null;
  }

  if (
    event.sourceId.length > MAX_EVENT_STRING_LENGTH ||
    event.nonce.length > MAX_EVENT_STRING_LENGTH ||
    event.notesPath.length > MAX_EVENT_STRING_LENGTH ||
    event.oldPath.length > MAX_EVENT_STRING_LENGTH ||
    event.newPath.length > MAX_EVENT_STRING_LENGTH
  ) {
    return null;
  }

  const notesPath = normalizeNotePathKey(event.notesPath);
  if (!notesPath || CONTROL_OR_BIDI_PATTERN.test(notesPath) || hasInternalNotePathSegment(notesPath)) {
    return null;
  }

  const oldPath = normalizeExternalRenamePath(event.oldPath, notesPath);
  const newPath = normalizeExternalRenamePath(event.newPath, notesPath);
  if (!oldPath || !newPath || oldPath === newPath) {
    return null;
  }

  return {
    type: 'rename',
    sourceId: event.sourceId,
    nonce: event.nonce,
    stamp: event.stamp,
    notesPath,
    oldPath,
    newPath,
  };
}

function normalizeExternalRenamePath(path: string, notesPath: string): string | null {
  if (CONTROL_OR_BIDI_PATTERN.test(path)) {
    return null;
  }

  const normalizedPath = normalizeNotesRootRelativePath(path);
  if (normalizedPath) {
    return hasInternalNotePathSegment(normalizedPath) ? null : normalizedPath;
  }

  const normalizedNotesPath = normalizeNotePathKey(notesPath);
  const normalizedAbsolutePath = normalizeNotePathKey(path);
  if (
    !normalizedNotesPath ||
    !normalizedAbsolutePath ||
    !isAbsolutePath(normalizedNotesPath) ||
    !isAbsolutePath(normalizedAbsolutePath) ||
    hasInternalNotePathSegment(normalizedAbsolutePath) ||
    hasUnsafeNotesRootPathSegment(normalizedAbsolutePath)
  ) {
    return null;
  }

  const containedPath = normalizeContainedAssetPath(normalizedAbsolutePath, normalizedNotesPath);
  return containedPath ? normalizeNotePathKey(containedPath) ?? null : null;
}
