import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FolderNode } from '@/stores/useNotesStore';
import {
  MAX_TAG_DIRECT_READ_CONTENT_CHARS,
  MAX_TAG_DIRECT_READ_MISSING_PATHS,
  useNotesSidebarTags,
} from './useNotesSidebarTags';

const MAX_TAG_CONTENT_READ_BYTES = 512 * 1024;

const mocked = vi.hoisted(() => ({
  readFile: vi.fn(async () => ''),
  stat: vi.fn(async (): Promise<{ isFile?: boolean; isDirectory?: boolean; size?: number } | null> => null),
}));

vi.mock('@/lib/storage/adapter', () => ({
  getStorageAdapter: () => ({
    readFile: mocked.readFile,
    stat: mocked.stat,
  }),
  isAbsolutePath: (path: string) => path.startsWith('/'),
  joinPath: async (...segments: string[]) => segments.join('/').replace(/\/+/g, '/'),
  normalizeAbsolutePath: (path: string) => {
    const normalized = path.replace(/\\/g, '/');
    if (!normalized.startsWith('/')) {
      return path;
    }

    const parts: string[] = [];
    for (const part of normalized.split('/')) {
      if (!part || part === '.') {
        continue;
      }
      if (part === '..') {
        parts.pop();
        continue;
      }
      parts.push(part);
    }
    return `/${parts.join('/')}`;
  },
}));

const rootFolder: FolderNode = {
  id: 'root',
  name: 'Notes',
  path: '',
  isFolder: true,
  expanded: true,
  children: [
    {
      id: 'alpha',
      name: 'alpha.md',
      path: 'alpha.md',
      isFolder: false,
    },
  ],
};

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

describe('useNotesSidebarTags', () => {
  beforeEach(() => {
    mocked.readFile.mockReset();
    mocked.stat.mockReset();
    mocked.stat.mockResolvedValue(null);
  });

  it('does not read missing sidebar tag content when stat is unavailable', async () => {
    const scanAllNotes = vi.fn(async () => undefined);

    renderHook(() => useNotesSidebarTags({
      rootFolder,
      noteContentsCache: new Map(),
      scanAllNotes,
      currentVaultPath: '/vault',
    }));

    await waitFor(() => {
      expect(mocked.stat).toHaveBeenCalledWith('/vault/alpha.md');
    });
    expect(mocked.readFile).not.toHaveBeenCalled();
  });

  it('reads missing sidebar tag content with bounded reads when stat has no size', async () => {
    const scanAllNotes = vi.fn(async () => undefined);
    mocked.stat.mockResolvedValue({ isFile: true, isDirectory: false });
    mocked.readFile.mockResolvedValue('Alpha #topic');

    const { result } = renderHook(() => useNotesSidebarTags({
      rootFolder,
      noteContentsCache: new Map(),
      scanAllNotes,
      currentVaultPath: '/vault',
    }));

    await waitFor(() => {
      expect(mocked.readFile).toHaveBeenCalledWith('/vault/alpha.md', MAX_TAG_CONTENT_READ_BYTES);
    });
    await waitFor(() => {
      expect(result.current.tags.map((entry) => entry.tag)).toEqual(['topic']);
    });
  });

  it('does not read oversized missing sidebar tag content', async () => {
    const scanAllNotes = vi.fn(async () => undefined);
    mocked.stat.mockResolvedValue({ isFile: true, size: 512 * 1024 + 1 });

    renderHook(() => useNotesSidebarTags({
      rootFolder,
      noteContentsCache: new Map(),
      scanAllNotes,
      currentVaultPath: '/vault',
    }));

    await waitFor(() => {
      expect(mocked.stat).toHaveBeenCalledWith('/vault/alpha.md');
    });
    expect(mocked.readFile).not.toHaveBeenCalled();
  });

  it('bounds total direct-read sidebar tag content', async () => {
    const scanAllNotes = vi.fn(async () => undefined);
    const maxDirectReads = MAX_TAG_DIRECT_READ_CONTENT_CHARS / MAX_TAG_CONTENT_READ_BYTES;
    mocked.stat.mockResolvedValue({ isFile: true, isDirectory: false, size: MAX_TAG_CONTENT_READ_BYTES });
    mocked.readFile.mockResolvedValue('x'.repeat(MAX_TAG_CONTENT_READ_BYTES));

    renderHook(() => useNotesSidebarTags({
      rootFolder: createRootFolderFromPaths(
        Array.from({ length: maxDirectReads + 1 }, (_value, index) => `note-${index}.md`),
      ),
      noteContentsCache: new Map(),
      scanAllNotes,
      currentVaultPath: '/vault',
    }));

    await waitFor(() => {
      expect(mocked.readFile).toHaveBeenCalledTimes(maxDirectReads);
    });
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });

    expect(mocked.readFile).toHaveBeenCalledTimes(maxDirectReads);
  });

  it('does not read missing sidebar tag content when stat reports an invalid negative size', async () => {
    const scanAllNotes = vi.fn(async () => undefined);
    mocked.stat.mockResolvedValue({ isFile: true, size: -1 });

    renderHook(() => useNotesSidebarTags({
      rootFolder,
      noteContentsCache: new Map(),
      scanAllNotes,
      currentVaultPath: '/vault',
    }));

    await waitFor(() => {
      expect(mocked.stat).toHaveBeenCalledWith('/vault/alpha.md');
    });
    expect(mocked.readFile).not.toHaveBeenCalled();
  });

  it('does not read unsafe file tree paths while loading missing sidebar tag content', async () => {
    const scanAllNotes = vi.fn(async () => undefined);
    const unsafeRootFolder: FolderNode = {
      id: 'root-unsafe',
      name: 'Notes',
      path: '',
      isFolder: true,
      expanded: true,
      children: [
        {
          id: 'traversal',
          name: 'secret.md',
          path: '../secret.md',
          isFolder: false,
        },
      ],
    };

    renderHook(() => useNotesSidebarTags({
      rootFolder: unsafeRootFolder,
      noteContentsCache: new Map(),
      scanAllNotes,
      currentVaultPath: '/vault',
    }));

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });

    expect(mocked.stat).not.toHaveBeenCalled();
    expect(mocked.readFile).not.toHaveBeenCalled();
  });

  it('does not read absolute non-Markdown sidebar tag content paths', async () => {
    const scanAllNotes = vi.fn(async () => undefined);

    renderHook(() => useNotesSidebarTags({
      rootFolder: null,
      noteContentsCache: new Map(),
      scanAllNotes,
      currentVaultPath: null,
      starredEntries: [
        {
          id: 'starred-asset',
          kind: 'note',
          vaultPath: '/vault',
          relativePath: 'asset.png',
          addedAt: 1,
        },
      ],
    }));

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });

    expect(mocked.stat).not.toHaveBeenCalled();
    expect(mocked.readFile).not.toHaveBeenCalled();
  });

  it('does not read absolute sidebar tag content paths with unsafe characters', async () => {
    const scanAllNotes = vi.fn(async () => undefined);

    renderHook(() => useNotesSidebarTags({
      rootFolder: null,
      noteContentsCache: new Map(),
      scanAllNotes,
      currentVaultPath: null,
      starredEntries: [
        {
          id: 'starred-unsafe',
          kind: 'note',
          vaultPath: '/vault',
          relativePath: 'secret\u202Egnp.md',
          addedAt: 1,
        },
      ],
    }));

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });

    expect(mocked.stat).not.toHaveBeenCalled();
    expect(mocked.readFile).not.toHaveBeenCalled();
  });

  it('does not read sidebar tag content from internal vault paths', async () => {
    const scanAllNotes = vi.fn(async () => undefined);

    renderHook(() => useNotesSidebarTags({
      rootFolder,
      noteContentsCache: new Map(),
      scanAllNotes,
      currentVaultPath: '/vault/.vlaina',
    }));

    await Promise.resolve();

    expect(mocked.stat).not.toHaveBeenCalled();
    expect(mocked.readFile).not.toHaveBeenCalled();
  });

  it('does not read sidebar tag content from vault paths with traversal segments', async () => {
    const scanAllNotes = vi.fn(async () => undefined);

    renderHook(() => useNotesSidebarTags({
      rootFolder,
      noteContentsCache: new Map(),
      scanAllNotes,
      currentVaultPath: '/vault/../outside',
    }));

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 0));
    });

    expect(mocked.stat).not.toHaveBeenCalled();
    expect(mocked.readFile).not.toHaveBeenCalled();
  });

  it('does not read sidebar tag content from case-variant internal vault paths', async () => {
    const scanAllNotes = vi.fn(async () => undefined);

    renderHook(() => useNotesSidebarTags({
      rootFolder,
      noteContentsCache: new Map(),
      scanAllNotes,
      currentVaultPath: '/vault/.VLAINA',
    }));

    await Promise.resolve();

    expect(mocked.stat).not.toHaveBeenCalled();
    expect(mocked.readFile).not.toHaveBeenCalled();
  });

  it('does not index sidebar tag content that is too complex after read', async () => {
    const scanAllNotes = vi.fn(async () => undefined);
    mocked.stat.mockResolvedValue({ isFile: true, size: 16 });
    mocked.readFile.mockResolvedValue(`#hidden ${'你'.repeat(Math.floor(MAX_TAG_CONTENT_READ_BYTES / 3) + 1)}`);

    const { result } = renderHook(() => useNotesSidebarTags({
      rootFolder,
      noteContentsCache: new Map(),
      scanAllNotes,
      currentVaultPath: '/vault',
    }));

    await waitFor(() => {
      expect(mocked.readFile).toHaveBeenCalledWith('/vault/alpha.md', MAX_TAG_CONTENT_READ_BYTES);
    });
    await waitFor(() => {
      expect(result.current.tags).toEqual([]);
    });
  });

  it('refreshes direct-read tag content when note cache revision changes', async () => {
    const scanAllNotes = vi.fn(async () => undefined);
    mocked.stat.mockResolvedValue({ isFile: true, size: 32 });
    let diskContent = 'First #old';
    mocked.readFile.mockImplementation(async () => diskContent);

    const { result, rerender } = renderHook(
      ({ revision }) => useNotesSidebarTags({
        rootFolder,
        noteContentsCache: new Map(),
        noteContentsCacheRevision: revision,
        scanAllNotes,
        currentVaultPath: '/vault',
      }),
      { initialProps: { revision: 0 } },
    );

    await waitFor(() => {
      expect(result.current.tags.map((entry) => entry.tag)).toEqual(['old']);
    });
    const initialReadCount = mocked.readFile.mock.calls.length;

    diskContent = 'Second #new';
    rerender({ revision: 1 });

    await waitFor(() => {
      expect(result.current.tags.map((entry) => entry.tag)).toEqual(['new']);
    });
    expect(mocked.readFile.mock.calls.length).toBeGreaterThan(initialReadCount);
  });

  it('does not fall back to stale direct-read tag content after scanned cache is pruned', async () => {
    const scanAllNotes = vi.fn(async () => undefined);
    mocked.stat.mockResolvedValue({ isFile: true, size: 32 });
    mocked.readFile.mockResolvedValue('First #old');

    const { result, rerender } = renderHook(
      ({ cache }) => useNotesSidebarTags({
        rootFolder,
        noteContentsCache: cache,
        noteContentsCacheRevision: 0,
        scanAllNotes,
        currentVaultPath: '/vault',
      }),
      { initialProps: { cache: new Map<string, { content: string }>() } },
    );

    await waitFor(() => {
      expect(result.current.tags.map((entry) => entry.tag)).toEqual(['old']);
    });

    rerender({
      cache: new Map([
        ['alpha.md', { content: 'Second #new' }],
      ]),
    });

    await waitFor(() => {
      expect(result.current.tags.map((entry) => entry.tag)).toEqual(['new']);
    });

    rerender({ cache: new Map() });

    await waitFor(() => {
      expect(result.current.tags.map((entry) => entry.tag)).toEqual(['new']);
    });
  });

  it('starts another tag scan when the scope changes during an in-flight scan', async () => {
    vi.useFakeTimers();
    const firstScan = createDeferredPromise();
    const scanAllNotes = vi.fn()
      .mockReturnValueOnce(firstScan.promise)
      .mockResolvedValue(undefined);
    mocked.stat.mockReturnValue(new Promise<null>(() => {}));

    try {
      const { rerender } = renderHook(
        ({ root }) => useNotesSidebarTags({
          rootFolder: root,
          noteContentsCache: new Map(),
          scanAllNotes,
          currentVaultPath: '/vault',
        }),
        {
          initialProps: {
            root: createRootFolderFromPaths(['alpha.md']),
          },
        },
      );

      await act(async () => {
        await vi.advanceTimersByTimeAsync(251);
      });
      expect(scanAllNotes).toHaveBeenCalledTimes(1);

      rerender({
        root: createRootFolderFromPaths(['alpha.md', 'beta.md']),
      });

      await act(async () => {
        firstScan.resolve();
        await firstScan.promise;
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(251);
      });

      expect(scanAllNotes).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('aborts an in-flight full tag scan once direct reads make the index ready', async () => {
    vi.useFakeTimers();
    const fullScan = createDeferredPromise();
    const directRead = createDeferredPromise();
    const scanSignals: AbortSignal[] = [];
    const scanAllNotes = vi.fn(({ signal }: { signal?: AbortSignal } = {}) => {
      if (signal) {
        scanSignals.push(signal);
      }
      return fullScan.promise;
    });
    mocked.stat.mockResolvedValue({ isFile: true, isDirectory: false, size: 32 });
    mocked.readFile.mockImplementation(async () => {
      await directRead.promise;
      return 'Alpha #topic';
    });

    try {
      const { result } = renderHook(() => useNotesSidebarTags({
        rootFolder,
        noteContentsCache: new Map(),
        scanAllNotes,
        currentVaultPath: '/vault',
      }));

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(251);
      });
      expect(scanAllNotes).toHaveBeenCalledTimes(1);
      expect(scanSignals[0]?.aborted).toBe(false);

      await act(async () => {
        directRead.resolve();
        await directRead.promise;
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(result.current.tags.map((entry) => entry.tag)).toEqual(['topic']);
      expect(scanSignals[0]?.aborted).toBe(true);

      await act(async () => {
        fullScan.resolve();
        await fullScan.promise;
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it('uses the idle full scan instead of direct reads when many tag contents are missing', async () => {
    vi.useFakeTimers();
    const scanAllNotes = vi.fn(async () => undefined);

    try {
      renderHook(() => useNotesSidebarTags({
        rootFolder: createRootFolderFromPaths(
          Array.from(
            { length: MAX_TAG_DIRECT_READ_MISSING_PATHS + 1 },
            (_value, index) => `note-${index}.md`,
          ),
        ),
        noteContentsCache: new Map(),
        scanAllNotes,
        currentVaultPath: '/vault',
      }));

      await act(async () => {
        await Promise.resolve();
      });
      expect(mocked.stat).not.toHaveBeenCalled();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(251);
      });
      expect(scanAllNotes).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
