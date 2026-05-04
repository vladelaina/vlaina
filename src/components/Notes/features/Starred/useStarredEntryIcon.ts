import { useEffect, useMemo, useState } from 'react';
import { getStorageAdapter, joinPath } from '@/lib/storage/adapter';
import { normalizeNotePathKey } from '@/lib/notes/displayName';
import { readNoteMetadataFromMarkdown } from '@/stores/notes/frontmatter';
import type { StarredEntry } from '@/stores/notes/types';

const MAX_STARRED_ICON_CACHE_ENTRIES = 300;

interface StarredIconCacheEntry {
  modifiedAt: number | null;
  size: number | null;
  icon: string | null;
}

const starredIconCache = new Map<string, StarredIconCacheEntry>();

function getStarredIconCacheKey(entry: StarredEntry) {
  const vaultPath = entry.vaultPath.replace(/\\/g, '/').replace(/\/+$/, '');
  const relativePath = normalizeNotePathKey(entry.relativePath) ?? entry.relativePath;
  return `${vaultPath}/${relativePath}`;
}

function touchStarredIconCacheEntry(cacheKey: string, entry: StarredIconCacheEntry) {
  starredIconCache.delete(cacheKey);
  starredIconCache.set(cacheKey, entry);
}

function setStarredIconCacheEntry(cacheKey: string, entry: StarredIconCacheEntry) {
  touchStarredIconCacheEntry(cacheKey, entry);

  while (starredIconCache.size > MAX_STARRED_ICON_CACHE_ENTRIES) {
    const oldestKey = starredIconCache.keys().next().value;
    if (oldestKey === undefined) {
      return;
    }
    starredIconCache.delete(oldestKey);
  }
}

function getFreshStarredIconCacheEntry(
  cacheKey: string,
  modifiedAt: number | null,
  size: number | null,
) {
  const cached = starredIconCache.get(cacheKey);
  if (!cached) {
    return null;
  }

  const canValidateCache = modifiedAt !== null || size !== null;
  if (!canValidateCache || cached.modifiedAt !== modifiedAt || cached.size !== size) {
    return null;
  }

  touchStarredIconCacheEntry(cacheKey, cached);
  return cached;
}

export function useStarredEntryIcon(entry: StarredEntry, enabled: boolean) {
  const cacheKey = useMemo(
    () => getStarredIconCacheKey(entry),
    [entry.relativePath, entry.vaultPath],
  );
  const [icon, setIcon] = useState<string | undefined>(() => {
    const cached = starredIconCache.get(cacheKey);
    return cached?.icon ?? undefined;
  });

  useEffect(() => {
    if (!enabled || entry.kind !== 'note') {
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const fullPath = await joinPath(entry.vaultPath, entry.relativePath);
        const storage = getStorageAdapter();
        const fileInfo = await storage.stat(fullPath).catch(() => null);
        const modifiedAt = fileInfo?.modifiedAt ?? null;
        const size = fileInfo?.size ?? null;
        const freshCached = getFreshStarredIconCacheEntry(cacheKey, modifiedAt, size);
        if (freshCached) {
          if (!cancelled) {
            setIcon(freshCached.icon ?? undefined);
          }
          return;
        }

        const content = await storage.readFile(fullPath);
        const nextIcon = readNoteMetadataFromMarkdown(content).icon ?? null;
        setStarredIconCacheEntry(cacheKey, {
          modifiedAt,
          size,
          icon: nextIcon,
        });
        if (!cancelled) {
          setIcon(nextIcon ?? undefined);
        }
      } catch {
        setStarredIconCacheEntry(cacheKey, {
          modifiedAt: null,
          size: null,
          icon: null,
        });
        if (!cancelled) {
          setIcon(undefined);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [cacheKey, enabled, entry.kind, entry.relativePath, entry.vaultPath]);

  return icon;
}
