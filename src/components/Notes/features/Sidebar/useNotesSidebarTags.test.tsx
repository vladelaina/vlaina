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
});
