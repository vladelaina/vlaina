import { useEffect, useMemo, useState } from 'react';
import { getStorageAdapter, joinPath } from '@/lib/storage/adapter';
import { normalizeNotePathKey } from '@/lib/notes/displayName';
import { readNoteMetadataFromMarkdown } from '@/stores/notes/frontmatter';
import type { StarredEntry } from '@/stores/notes/types';

const starredIconCache = new Map<string, string | null>();

function getStarredIconCacheKey(entry: StarredEntry) {
  const vaultPath = entry.vaultPath.replace(/\\/g, '/').replace(/\/+$/, '');
  const relativePath = normalizeNotePathKey(entry.relativePath) ?? entry.relativePath;
  return `${vaultPath}/${relativePath}`;
}

export function useStarredEntryIcon(entry: StarredEntry, enabled: boolean) {
  const cacheKey = useMemo(() => getStarredIconCacheKey(entry), [entry]);
  const [icon, setIcon] = useState<string | undefined>(() => {
    const cached = starredIconCache.get(cacheKey);
    return cached ?? undefined;
  });

  useEffect(() => {
    if (!enabled || entry.kind !== 'note') {
      return;
    }

    const cached = starredIconCache.get(cacheKey);
    if (cached !== undefined) {
      setIcon(cached ?? undefined);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const fullPath = await joinPath(entry.vaultPath, entry.relativePath);
        const content = await getStorageAdapter().readFile(fullPath);
        const nextIcon = readNoteMetadataFromMarkdown(content).icon ?? null;
        starredIconCache.set(cacheKey, nextIcon);
        if (!cancelled) {
          setIcon(nextIcon ?? undefined);
        }
      } catch {
        starredIconCache.set(cacheKey, null);
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
