import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FolderNode } from '@/stores/useNotesStore';
import { useNotesSidebarTags } from './useNotesSidebarTags';

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

describe('useNotesSidebarTags', () => {
  beforeEach(() => {
    mocked.readFile.mockReset();
    mocked.stat.mockReset();
    mocked.stat.mockResolvedValue(null);
  });

  it('does not read missing sidebar tag content when stat has no size', async () => {
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

    await Promise.resolve();

    expect(mocked.stat).not.toHaveBeenCalled();
    expect(mocked.readFile).not.toHaveBeenCalled();
  });

  it('does not index sidebar tag content that is too complex after read', async () => {
    const scanAllNotes = vi.fn(async () => undefined);
    mocked.stat.mockResolvedValue({ isFile: true, size: 16 });
    mocked.readFile.mockResolvedValue(`#hidden ${'x'.repeat(512 * 1024 + 1)}`);

    const { result } = renderHook(() => useNotesSidebarTags({
      rootFolder,
      noteContentsCache: new Map(),
      scanAllNotes,
      currentVaultPath: '/vault',
    }));

    await waitFor(() => {
      expect(mocked.readFile).toHaveBeenCalledWith('/vault/alpha.md');
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
});
