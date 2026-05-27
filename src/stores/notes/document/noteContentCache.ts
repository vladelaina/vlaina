import type { NoteContentCacheEntry } from '../types';

export type NoteContentCache = Map<string, NoteContentCacheEntry>;

export function getCachedNoteContent(cache: NoteContentCache, path: string): string | undefined {
  return cache.get(path)?.content;
}

export function getCachedNoteModifiedAt(cache: NoteContentCache, path: string): number | null {
  return cache.get(path)?.modifiedAt ?? null;
}

function defineHiddenCacheMetadata(
  entry: NoteContentCacheEntry,
  options: { savedContent?: string; freshUntil?: number }
): void {
  if (options.savedContent !== undefined) {
    Object.defineProperty(entry, 'savedContent', {
      configurable: true,
      enumerable: false,
      value: options.savedContent,
    });
  }

  if (options.freshUntil !== undefined) {
    Object.defineProperty(entry, 'freshUntil', {
      configurable: true,
      enumerable: false,
      value: options.freshUntil,
    });
  }
}

export function setCachedNoteContent(
  cache: NoteContentCache,
  path: string,
  content: string,
  modifiedAt: number | null,
  options: { updateBaseline?: boolean; baselineContent?: string; freshUntil?: number } = {}
): NoteContentCache {
  const current = cache.get(path);
  const savedContent = options.baselineContent ?? (options.updateBaseline
    ? content
    : current?.savedContent ?? current?.content ?? content);
  const nextSavedContent = savedContent === content ? undefined : savedContent;
  const nextFreshUntil = options.freshUntil;
  if (
    current?.content === content &&
    current.modifiedAt === modifiedAt &&
    current.savedContent === nextSavedContent &&
    current.freshUntil === nextFreshUntil
  ) {
    return cache;
  }

  const nextCache = new Map(cache);
  const nextEntry: NoteContentCacheEntry = { content, modifiedAt };
  defineHiddenCacheMetadata(nextEntry, {
    savedContent: nextSavedContent,
    freshUntil: nextFreshUntil,
  });
  nextCache.set(path, nextEntry);
  return nextCache;
}

export function markCachedNoteFresh(
  cache: NoteContentCache,
  path: string,
  freshUntil: number
): NoteContentCache {
  const current = cache.get(path);
  if (!current || current.freshUntil === freshUntil) {
    return cache;
  }

  return setCachedNoteContent(cache, path, current.content, current.modifiedAt, {
    baselineContent: current.savedContent,
    freshUntil,
  });
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

export function limitCachedNoteContents(
  cache: NoteContentCache,
  keepPaths: ReadonlySet<string>,
  maxEntries: number
): NoteContentCache {
  if (cache.size <= maxEntries) {
    return cache;
  }

  const nextCache = new Map(cache);
  for (const path of nextCache.keys()) {
    if (nextCache.size <= maxEntries) {
      break;
    }

    if (!keepPaths.has(path)) {
      nextCache.delete(path);
    }
  }

  return nextCache.size === cache.size ? cache : nextCache;
}
