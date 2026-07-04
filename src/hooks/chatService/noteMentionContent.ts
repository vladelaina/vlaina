import { getStorageAdapter } from '@/lib/storage/adapter';
import { useNotesStore } from '@/stores/notes/useNotesStore';
import {
  MAX_NOTE_MENTION_READ_BYTES,
  noteMentionUtf8Encoder,
} from './noteMentionConfig';
import { resolveMentionedPath } from './noteMentionPaths';

function canUseCachedMentionContent(cached: { modifiedAt?: number | null; size?: number | null }): boolean {
  return !(cached.modifiedAt == null && Object.prototype.hasOwnProperty.call(cached, 'size'));
}

function isNoteMentionContentWithinReadLimit(content: string): boolean {
  return (
    content.length <= MAX_NOTE_MENTION_READ_BYTES &&
    noteMentionUtf8Encoder.encode(content).length <= MAX_NOTE_MENTION_READ_BYTES
  );
}

function canReadNoteMentionFile(
  fileInfo: { isFile?: boolean; isDirectory?: boolean; size?: number | null } | null | undefined,
): boolean {
  if (!fileInfo || fileInfo.isDirectory === true || fileInfo.isFile === false) {
    return false;
  }

  if (typeof fileInfo.size !== 'number') {
    return true;
  }

  return (
    Number.isFinite(fileInfo.size) &&
    fileInfo.size >= 0 &&
    fileInfo.size <= MAX_NOTE_MENTION_READ_BYTES
  );
}

export async function readResolvedMentionedNoteContent(
  resolvedPath: { cachePath: string; fullPath: string },
  cacheAliases: readonly string[] = [],
): Promise<string> {
  const notesState = useNotesStore.getState();
  const cachePaths = Array.from(new Set([
    resolvedPath.cachePath,
    resolvedPath.fullPath,
    ...cacheAliases,
  ]));

  if (notesState.currentNote && cachePaths.includes(notesState.currentNote.path)) {
    const content = notesState.currentNote.content || '';
    return isNoteMentionContentWithinReadLimit(content) ? content : '';
  }

  for (const cachePath of cachePaths) {
    const cached = notesState.noteContentsCache.get(cachePath);
    if (cached) {
      if (!isNoteMentionContentWithinReadLimit(cached.content)) {
        return '';
      }
      if (canUseCachedMentionContent(cached)) {
        return cached.content;
      }
    }
  }

  const storage = getStorageAdapter();
  try {
    const fileInfo = await storage.stat(resolvedPath.fullPath).catch(() => null);
    if (!canReadNoteMentionFile(fileInfo)) {
      return '';
    }
    const content = await storage.readFile(resolvedPath.fullPath, MAX_NOTE_MENTION_READ_BYTES);
    return typeof content === 'string' && isNoteMentionContentWithinReadLimit(content)
      ? content
      : '';
  } catch {
    return '';
  }
}

export async function resolveMentionedNoteContent(notePath: string): Promise<string> {
  const resolvedPath = await resolveMentionedPath(notePath, 'note');
  if (!resolvedPath) {
    return '';
  }
  return readResolvedMentionedNoteContent(resolvedPath, [notePath]);
}
