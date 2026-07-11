import { readNoteMetadataFromMarkdown } from '@/stores/notes/frontmatter';
import type { NoteCoverMetadata, NotesStore } from '@/stores/notes/types';

const COVER_SNAPSHOT_SEPARATOR = '\u001f';
const coverSnapshotCache = new Map<string, NoteCoverMetadata>();

function getCoverSnapshotCacheKey(notesPath: string | undefined, path: string): string {
  return [notesPath ?? '', path].join(COVER_SNAPSHOT_SEPARATOR);
}

function coverEntriesEqual(
  first: NoteCoverMetadata | undefined,
  second: NoteCoverMetadata | undefined,
): boolean {
  return (
    first?.assetPath === second?.assetPath &&
    first?.positionX === second?.positionX &&
    first?.positionY === second?.positionY &&
    first?.height === second?.height &&
    first?.scale === second?.scale
  );
}

function getStableCachedCoverEntry(
  cacheKey: string,
  cover: NoteCoverMetadata | undefined,
): NoteCoverMetadata | undefined {
  if (!cover?.assetPath) {
    coverSnapshotCache.delete(cacheKey);
    return undefined;
  }

  const previous = coverSnapshotCache.get(cacheKey);
  if (coverEntriesEqual(previous, cover)) {
    return previous;
  }

  const next = { ...cover };
  coverSnapshotCache.set(cacheKey, next);
  return next;
}

export function clearNoteCoverSnapshotCacheForTests(): void {
  coverSnapshotCache.clear();
}

export function getStableNoteCoverEntrySnapshot(
  path: string | undefined,
  state: Pick<NotesStore, 'currentNote' | 'noteMetadata' | 'notesPath'>,
): NoteCoverMetadata | undefined {
  if (!path) return undefined;

  const cacheKey = getCoverSnapshotCacheKey(state.notesPath, path);
  const notes = state.noteMetadata?.notes;
  if (notes && Object.prototype.hasOwnProperty.call(notes, path)) {
    return getStableCachedCoverEntry(cacheKey, notes[path]?.cover);
  }

  if (state.currentNote?.path === path) {
    const cover = readNoteMetadataFromMarkdown(state.currentNote.content).cover;
    if (cover?.assetPath) {
      return getStableCachedCoverEntry(cacheKey, cover);
    }
  }

  return coverSnapshotCache.get(cacheKey);
}
