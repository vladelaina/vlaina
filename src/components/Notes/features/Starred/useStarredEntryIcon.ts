import { useEffect, useMemo, useState } from 'react';
import { getStorageAdapter, joinPath } from '@/lib/storage/adapter';
import { readNoteMetadataFromMarkdown } from '@/stores/notes/frontmatter';
import {
  isValidStarredVaultPath,
  normalizeStarredRelativePath,
  normalizeStarredVaultPath,
} from '@/stores/notes/starred';
import type { StarredEntry } from '@/stores/notes/types';

const MAX_STARRED_ICON_CACHE_ENTRIES = 300;
const MAX_STARRED_ICON_METADATA_BYTES = 512 * 1024;
const MAX_CONCURRENT_STARRED_ICON_READS = 4;

interface StarredIconCacheEntry {
  modifiedAt: number | null;
  size: number | null;
  icon: string | null;
}

const starredIconCache = new Map<string, StarredIconCacheEntry>();
const pendingStarredIconTasks: Array<() => void> = [];
let activeStarredIconTaskCount = 0;

function runQueuedStarredIconTask() {
  if (activeStarredIconTaskCount >= MAX_CONCURRENT_STARRED_ICON_READS) {
    return;
  }

  const task = pendingStarredIconTasks.shift();
  if (!task) {
    return;
  }

  activeStarredIconTaskCount += 1;
  task();
}

function scheduleStarredIconTask<T>(task: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    pendingStarredIconTasks.push(() => {
      void task().then(resolve, reject).finally(() => {
        activeStarredIconTaskCount -= 1;
        runQueuedStarredIconTask();
      });
    });
    runQueuedStarredIconTask();
  });
}

function getStarredIconPathContext(entry: StarredEntry) {
  const relativePath = normalizeStarredRelativePath(entry.relativePath);
  if (!relativePath) {
    return null;
  }

  const vaultPath = normalizeStarredVaultPath(entry.vaultPath);
  if (!isValidStarredVaultPath(vaultPath)) {
    return null;
  }

  return {
    vaultPath,
    relativePath,
    cacheKey: `${vaultPath}/${relativePath}`,
  };
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

  const canValidateCache = modifiedAt !== null;
  if (!canValidateCache || cached.modifiedAt !== modifiedAt || cached.size !== size) {
    return null;
  }

  touchStarredIconCacheEntry(cacheKey, cached);
  return cached;
}

function canReadStarredIconMetadata(fileInfo: {
  isFile?: boolean;
  isDirectory?: boolean;
  size?: number | null;
} | null | undefined) {
  return (
    fileInfo?.isDirectory !== true &&
    fileInfo?.isFile !== false &&
    typeof fileInfo?.size === 'number' &&
    fileInfo.size <= MAX_STARRED_ICON_METADATA_BYTES
  );
}

export function useStarredEntryIcon(entry: StarredEntry, enabled: boolean) {
  const pathContext = useMemo(
    () => getStarredIconPathContext(entry),
    [entry.relativePath, entry.vaultPath],
  );
  const [icon, setIcon] = useState<string | undefined>(() => {
    const cached = pathContext ? starredIconCache.get(pathContext.cacheKey) : null;
    return cached?.modifiedAt !== null ? cached?.icon ?? undefined : undefined;
  });

  useEffect(() => {
    if (!enabled || entry.kind !== 'note') {
      return;
    }
    if (!pathContext) {
      setIcon(undefined);
      return;
    }

    const cacheKey = pathContext.cacheKey;
    let cancelled = false;
    void (async () => {
      try {
        await scheduleStarredIconTask(async () => {
          const fullPath = await joinPath(pathContext.vaultPath, pathContext.relativePath);
          const storage = getStorageAdapter();
          const fileInfo = await storage.stat(fullPath).catch(() => null);
          const modifiedAt = fileInfo?.modifiedAt ?? null;
          const size = fileInfo?.size ?? null;
          if (!canReadStarredIconMetadata(fileInfo)) {
            setStarredIconCacheEntry(cacheKey, {
              modifiedAt,
              size,
              icon: null,
            });
            if (!cancelled) {
              setIcon(undefined);
            }
            return;
          }

          const freshCached = getFreshStarredIconCacheEntry(cacheKey, modifiedAt, size);
          if (freshCached) {
            if (!cancelled) {
              setIcon(freshCached.icon ?? undefined);
            }
            return;
          }

          const content = await storage.readFile(fullPath);
          const nextIcon = content.length <= MAX_STARRED_ICON_METADATA_BYTES
            ? readNoteMetadataFromMarkdown(content).icon ?? null
            : null;
          setStarredIconCacheEntry(cacheKey, {
            modifiedAt,
            size,
            icon: nextIcon,
          });
          if (!cancelled) {
            setIcon(nextIcon ?? undefined);
          }
        });
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
  }, [enabled, entry.kind, pathContext]);

  return icon;
}
