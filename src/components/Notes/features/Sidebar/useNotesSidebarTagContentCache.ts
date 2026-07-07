import { useEffect, useRef, useState } from 'react';
import {
  MAX_TAG_CONTENT_READ_BYTES,
  readSidebarTagContent,
} from './notesSidebarTagContentReader';
import type { NotesSidebarTagScopeEntry } from './notesSidebarTags';

const TAG_CONTENT_READ_BATCH_SIZE = 8;
export const MAX_TAG_DIRECT_READ_MISSING_PATHS = 200;
export const MAX_TAG_DIRECT_READ_CONTENT_CHARS = 8 * 1024 * 1024;

export type SidebarTagContentCacheEntry = {
  content: string;
  revision: number;
  notesRootPath: string | null;
};
export type SidebarTagContentCache = Map<string, SidebarTagContentCacheEntry>;
type SidebarTagDirectReadBudget = {
  contentChars: number;
  revision: number;
  scopeKey: string;
  notesRootPath: string | null;
};

export function isFreshSidebarTagContentEntry(
  entry: SidebarTagContentCacheEntry | undefined,
  revision: number,
  notesRootPath: string | null,
) {
  return entry?.revision === revision && entry.notesRootPath === notesRootPath;
}

function getSidebarTagScopeBudgetKey(entries: readonly NotesSidebarTagScopeEntry[]): string {
  const firstPath = entries[0]?.path ?? '';
  const lastPath = entries[entries.length - 1]?.path ?? '';
  return `${entries.length}\n${firstPath}\n${lastPath}`;
}

export function useNotesSidebarTagContentCache({
  active,
  currentNotesRootPath,
  liveNoteContentPath,
  missingIndexedContent,
  noteContentsCache,
  noteContentsCacheRevision,
  scopeEntries,
}: {
  active: boolean;
  currentNotesRootPath: string | null;
  liveNoteContentPath?: string;
  missingIndexedContent: boolean;
  noteContentsCache: Map<string, { content: string }>;
  noteContentsCacheRevision: number;
  scopeEntries: NotesSidebarTagScopeEntry[];
}) {
  const directReadBudgetRef = useRef<SidebarTagDirectReadBudget | null>(null);
  const [sidebarTagContentCache, setSidebarTagContentCache] = useState<SidebarTagContentCache>(
    () => new Map(),
  );

  useEffect(() => {
    const scopedPaths = new Set(scopeEntries.map((entry) => entry.path));
    setSidebarTagContentCache((current) => {
      let changed = false;
      const next: SidebarTagContentCache = new Map();
      for (const [path, entry] of current) {
        if (
          scopedPaths.has(path) &&
          isFreshSidebarTagContentEntry(entry, noteContentsCacheRevision, currentNotesRootPath)
        ) {
          next.set(path, entry);
        } else {
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [currentNotesRootPath, noteContentsCacheRevision, scopeEntries]);

  useEffect(() => {
    if (noteContentsCache.size === 0 || scopeEntries.length === 0) {
      return;
    }

    setSidebarTagContentCache((current) => {
      let changed = false;
      const next = new Map(current);

      for (const entry of scopeEntries) {
        const cachedContent = noteContentsCache.get(entry.path)?.content;
        if (cachedContent === undefined) {
          continue;
        }

        const currentEntry = next.get(entry.path);
        if (
          currentEntry?.content === cachedContent &&
          currentEntry.revision === noteContentsCacheRevision &&
          currentEntry.notesRootPath === currentNotesRootPath
        ) {
          continue;
        }

        next.set(entry.path, {
          content: cachedContent,
          revision: noteContentsCacheRevision,
          notesRootPath: currentNotesRootPath,
        });
        changed = true;
      }

      return changed ? next : current;
    });
  }, [currentNotesRootPath, noteContentsCache, noteContentsCacheRevision, scopeEntries]);

  useEffect(() => {
    if (!active || scopeEntries.length === 0 || !missingIndexedContent) {
      return;
    }

    const missingPaths = scopeEntries
      .map((entry) => entry.path)
      .filter((path) =>
        liveNoteContentPath !== path &&
        !noteContentsCache.has(path) &&
        !isFreshSidebarTagContentEntry(
          sidebarTagContentCache.get(path),
          noteContentsCacheRevision,
          currentNotesRootPath,
        )
      );
    if (missingPaths.length === 0 || missingPaths.length > MAX_TAG_DIRECT_READ_MISSING_PATHS) {
      return;
    }

    const scopeBudgetKey = getSidebarTagScopeBudgetKey(scopeEntries);
    let directReadBudget = directReadBudgetRef.current;
    if (
      !directReadBudget ||
      directReadBudget.scopeKey !== scopeBudgetKey ||
      directReadBudget.revision !== noteContentsCacheRevision ||
      directReadBudget.notesRootPath !== currentNotesRootPath
    ) {
      directReadBudget = {
        contentChars: 0,
        revision: noteContentsCacheRevision,
        scopeKey: scopeBudgetKey,
        notesRootPath: currentNotesRootPath,
      };
      directReadBudgetRef.current = directReadBudget;
    }
    if (directReadBudget.contentChars >= MAX_TAG_DIRECT_READ_CONTENT_CHARS) {
      return;
    }

    const activeDirectReadBudget = directReadBudget;
    let cancelled = false;
    const loadMissingContent = async () => {
      const loaded: SidebarTagContentCache = new Map();
      for (let index = 0; index < missingPaths.length;) {
        if (activeDirectReadBudget.contentChars >= MAX_TAG_DIRECT_READ_CONTENT_CHARS) {
          break;
        }

        const remainingBatchCapacity = Math.floor(
          (MAX_TAG_DIRECT_READ_CONTENT_CHARS - activeDirectReadBudget.contentChars) / MAX_TAG_CONTENT_READ_BYTES,
        );
        if (remainingBatchCapacity <= 0) {
          break;
        }

        const batch = missingPaths.slice(
          index,
          index + Math.min(TAG_CONTENT_READ_BATCH_SIZE, remainingBatchCapacity),
        );
        index += batch.length;
        const reservedContentChars = batch.length * MAX_TAG_CONTENT_READ_BYTES;
        activeDirectReadBudget.contentChars += reservedContentChars;
        const results = await Promise.all(
          batch.map(async (path) => ({
            path,
            content: await readSidebarTagContent(path, currentNotesRootPath),
          })),
        );
        if (cancelled || directReadBudgetRef.current !== activeDirectReadBudget) {
          return;
        }
        activeDirectReadBudget.contentChars = Math.max(
          0,
          activeDirectReadBudget.contentChars - reservedContentChars,
        );
        for (const result of results) {
          if (activeDirectReadBudget.contentChars + result.content.length > MAX_TAG_DIRECT_READ_CONTENT_CHARS) {
            continue;
          }

          activeDirectReadBudget.contentChars += result.content.length;
          loaded.set(result.path, {
            content: result.content,
            revision: noteContentsCacheRevision,
            notesRootPath: currentNotesRootPath,
          });
        }
      }
      if (cancelled || loaded.size === 0) {
        return;
      }
      setSidebarTagContentCache((current) => {
        const next = new Map(current);
        for (const [path, entry] of loaded) {
          next.set(path, entry);
        }
        return next;
      });
    };

    void loadMissingContent().catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [
    active,
    currentNotesRootPath,
    liveNoteContentPath,
    missingIndexedContent,
    noteContentsCache,
    noteContentsCacheRevision,
    scopeEntries,
    sidebarTagContentCache,
  ]);

  return sidebarTagContentCache;
}
