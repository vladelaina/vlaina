import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { FolderNode } from '@/stores/useNotesStore';
import {
  NOTES_SIDEBAR_MAX_SEARCH_RESULTS,
} from './notesSidebarSearchResults';
import { useSidebarContentSearchResults } from './useSidebarContentSearchResults';

function createRootFolder(noteCount: number, namePrefix: string): FolderNode {
  return {
    id: 'root',
    name: 'Notes',
    path: '',
    isFolder: true,
    expanded: true,
    children: Array.from({ length: noteCount }, (_, index) => ({
      id: `note-${index}`,
      name: `${namePrefix}-${index}.md`,
      path: `docs/${namePrefix}-${index}.md`,
      isFolder: false,
    })),
  };
}

function createRootFolderFromPaths(paths: string[]): FolderNode {
  return {
    id: 'root',
    name: 'Notes',
    path: '',
    isFolder: true,
    expanded: true,
    children: paths.map((path) => ({
      id: path,
      name: path.split('/').pop() ?? path,
      path,
      isFolder: false,
    })),
  };
}

function createDeferredPromise() {
  let resolve!: () => void;
  const promise = new Promise<void>((innerResolve) => {
    resolve = innerResolve;
  });

  return { promise, resolve };
}

describe('useSidebarContentSearchResults', () => {
  it('does not scan note contents when structural results fill the result limit', async () => {
    const scanAllNotes = vi.fn(async () => undefined);

    const { result } = renderHook(() => useSidebarContentSearchResults({
      rootFolder: createRootFolder(NOTES_SIDEBAR_MAX_SEARCH_RESULTS + 10, 'alpha'),
      getDisplayName: (path) => path.split('/').pop() ?? path,
      noteContentsCache: new Map(),
      scanAllNotes,
      cancelNoteContentScan: vi.fn(),
      pruneNoteContentsCacheToOpenNotes: vi.fn(),
      searchQuery: 'alpha',
      isSearchOpen: true,
    }));

    await waitFor(() => {
      expect(result.current.searchResults).toHaveLength(NOTES_SIDEBAR_MAX_SEARCH_RESULTS);
    });
    expect(scanAllNotes).not.toHaveBeenCalled();
    expect(result.current.isContentScanPending).toBe(false);
  });

  it('scans note contents when visible structural results do not fill the result limit', async () => {
    const scanAllNotes = vi.fn(() => new Promise<void>(() => {}));

    const { result } = renderHook(() => useSidebarContentSearchResults({
      rootFolder: createRootFolder(2, 'alpha'),
      getDisplayName: (path) => path.split('/').pop() ?? path,
      noteContentsCache: new Map(),
      scanAllNotes,
      cancelNoteContentScan: vi.fn(),
      pruneNoteContentsCacheToOpenNotes: vi.fn(),
      searchQuery: 'alpha',
      isSearchOpen: true,
    }));

    await waitFor(() => {
      expect(scanAllNotes).toHaveBeenCalledTimes(1);
    });
    expect(result.current.isContentScanPending).toBe(true);
  });

  it('starts another scan when searchable entries change during an in-flight scan', async () => {
    const firstScan = createDeferredPromise();
    const scanAllNotes = vi.fn()
      .mockReturnValueOnce(firstScan.promise)
      .mockReturnValue(new Promise<void>(() => {}));
    const cancelNoteContentScan = vi.fn();
    const pruneNoteContentsCacheToOpenNotes = vi.fn();

    const { rerender } = renderHook(
      ({ rootFolder, cache }) => useSidebarContentSearchResults({
        rootFolder,
        getDisplayName: (path) => path.split('/').pop() ?? path,
        noteContentsCache: cache,
        scanAllNotes,
        cancelNoteContentScan,
        pruneNoteContentsCacheToOpenNotes,
        searchQuery: 'needle',
        isSearchOpen: true,
      }),
      {
        initialProps: {
          rootFolder: createRootFolderFromPaths(['docs/alpha.md']),
          cache: new Map<string, { content: string }>(),
        },
      },
    );

    await waitFor(() => {
      expect(scanAllNotes).toHaveBeenCalledTimes(1);
    });

    rerender({
      rootFolder: createRootFolderFromPaths(['docs/alpha.md', 'docs/beta.md']),
      cache: new Map(),
    });

    await act(async () => {
      firstScan.resolve();
      await firstScan.promise;
    });

    await waitFor(() => {
      expect(scanAllNotes).toHaveBeenCalledTimes(2);
    });
  });

  it('aborts an in-flight content scan once the cache makes the index ready', async () => {
    const firstScan = createDeferredPromise();
    const scanSignals: AbortSignal[] = [];
    const scanAllNotes = vi.fn(({ signal }: { signal?: AbortSignal } = {}) => {
      if (signal) {
        scanSignals.push(signal);
      }
      return firstScan.promise;
    });
    const cancelNoteContentScan = vi.fn();
    const pruneNoteContentsCacheToOpenNotes = vi.fn();

    const { result, rerender } = renderHook(
      ({ cache }) => useSidebarContentSearchResults({
        rootFolder: createRootFolderFromPaths(['docs/alpha.md']),
        getDisplayName: (path) => path.split('/').pop() ?? path,
        noteContentsCache: cache,
        scanAllNotes,
        cancelNoteContentScan,
        pruneNoteContentsCacheToOpenNotes,
        searchQuery: 'needle',
        isSearchOpen: true,
      }),
      {
        initialProps: {
          cache: new Map<string, { content: string }>(),
        },
      },
    );

    await waitFor(() => {
      expect(scanAllNotes).toHaveBeenCalledTimes(1);
    });
    expect(scanSignals[0]?.aborted).toBe(false);

    rerender({
      cache: new Map([['docs/alpha.md', { content: 'body needle' }]]),
    });

    await waitFor(() => {
      expect(result.current.searchResults.map((entry) => entry.path)).toEqual(['docs/alpha.md']);
    });
    expect(result.current.isContentScanPending).toBe(false);
    expect(scanSignals[0]?.aborted).toBe(true);
    expect(cancelNoteContentScan).not.toHaveBeenCalled();
    expect(pruneNoteContentsCacheToOpenNotes).not.toHaveBeenCalled();

    await act(async () => {
      firstScan.resolve();
      await firstScan.promise;
    });
  });

  it('does not repeatedly rescan unchanged oversized content indexes after a completed scan', async () => {
    const scanAllNotes = vi.fn(async () => undefined);
    const cancelNoteContentScan = vi.fn();
    const pruneNoteContentsCacheToOpenNotes = vi.fn();
    const rootFolder = createRootFolder(1001, 'alpha');
    const getDisplayName = (path: string) => path.split('/').pop() ?? path;

    const { result, rerender } = renderHook(
      ({ cache, revision }) => useSidebarContentSearchResults({
        rootFolder,
        getDisplayName,
        noteContentsCache: cache,
        noteContentsCacheRevision: revision,
        scanAllNotes,
        cancelNoteContentScan,
        pruneNoteContentsCacheToOpenNotes,
        searchQuery: 'needle',
        isSearchOpen: true,
      }),
      {
        initialProps: {
          cache: new Map<string, { content: string }>(),
          revision: 0,
        },
      },
    );

    await waitFor(() => {
      expect(scanAllNotes).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(result.current.isContentScanPending).toBe(false);
    });

    rerender({
      cache: new Map([['docs/alpha-0.md', { content: 'plain text' }]]),
      revision: 0,
    });
    await act(async () => {
      await Promise.resolve();
    });
    expect(scanAllNotes).toHaveBeenCalledTimes(1);

    rerender({
      cache: new Map([['docs/alpha-0.md', { content: 'plain text' }]]),
      revision: 1,
    });
    await waitFor(() => {
      expect(scanAllNotes).toHaveBeenCalledTimes(2);
    });
  });
});
