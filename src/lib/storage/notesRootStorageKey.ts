import { normalizeNotePathKey } from '@/lib/notes/displayName';

export function getNotesRootStorageKey(notesRootPath: string): string {
  const normalized = normalizeNotePathKey(notesRootPath) ?? notesRootPath.replace(/\\/g, '/');
  let hash = 2166136261;
  for (let index = 0; index < normalized.length; index += 1) {
    hash ^= normalized.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `notes-root-${(hash >>> 0).toString(36)}`;
}
