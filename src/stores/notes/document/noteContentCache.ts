import type { NoteContentCacheEntry } from '../types';

export type NoteContentCache = Map<string, NoteContentCacheEntry>;

export function getCachedNoteContent(cache: NoteContentCache, path: string): string | undefined {
  return cache.get(path)?.content;
}

export function getCachedNoteModifiedAt(cache: NoteContentCache, path: string): number | null {
  return cache.get(path)?.modifiedAt ?? null;
}

export function setCachedNoteContent(
  cache: NoteContentCache,
  path: string,
  content: string,
  modifiedAt: number | null
): NoteContentCache {
  const nextCache = new Map(cache);
  nextCache.set(path, { content, modifiedAt });
  return nextCache;
}

export function removeCachedNoteContent(cache: NoteContentCache, path: string): NoteContentCache {
  if (!cache.has(path)) {
    return cache;
  }

  const nextCache = new Map(cache);
  nextCache.delete(path);
  return nextCache;
}

export function remapCachedNoteContents(
  cache: NoteContentCache,
  remapPath: (path: string) => string | null
): NoteContentCache {
  let changed = false;
  const nextCache: NoteContentCache = new Map();

  for (const [path, entry] of cache.entries()) {
    const nextPath = remapPath(path);
    if (nextPath == null) {
      changed = true;
      continue;
    }

    if (nextPath !== path) {
      changed = true;
    }

    nextCache.set(nextPath, entry);
  }

  return changed ? nextCache : cache;
}

export function pruneCachedNoteContents(
  cache: NoteContentCache,
  shouldRemove: (path: string) => boolean
): NoteContentCache {
  return remapCachedNoteContents(cache, (path) => (shouldRemove(path) ? null : path));
}
