import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useStarredEntryIcon } from './useStarredEntryIcon';

const mocked = vi.hoisted(() => ({
  readFile: vi.fn(async () => ''),
  stat: vi.fn(async (): Promise<{ modifiedAt?: number; size?: number } | null> => null),
}));

vi.mock('@/lib/storage/adapter', () => ({
  getStorageAdapter: () => ({
    readFile: mocked.readFile,
    stat: mocked.stat,
  }),
  joinPath: async (...segments: string[]) => segments.join('/').replace(/\/+/g, '/'),
}));

describe('useStarredEntryIcon', () => {
  beforeEach(() => {
    mocked.readFile.mockReset();
    mocked.stat.mockReset();
    mocked.stat.mockResolvedValue(null);
  });

  it('loads a starred note icon from its vault markdown frontmatter', async () => {
    mocked.stat.mockResolvedValue({ modifiedAt: 1, size: 32 });
    mocked.readFile.mockResolvedValue('---\nvlaina_icon: "💡"\n---\n# Alpha');

    const { result } = renderHook(() =>
      useStarredEntryIcon({
        id: 'starred-1',
        kind: 'note',
        vaultPath: '/vault-b',
        relativePath: 'docs/alpha.md',
        addedAt: 1,
      }, true),
    );

    await waitFor(() => {
      expect(result.current).toBe('💡');
    });
    expect(mocked.readFile).toHaveBeenCalledWith('/vault-b/docs/alpha.md');
  });

  it('reloads a cached starred note icon when file metadata changes', async () => {
    mocked.stat.mockResolvedValueOnce({ modifiedAt: 1, size: 32 });
    mocked.readFile.mockResolvedValueOnce('---\nvlaina_icon: "💡"\n---\n# Alpha');

    const first = renderHook(() =>
      useStarredEntryIcon({
        id: 'starred-2',
        kind: 'note',
        vaultPath: '/vault-b',
        relativePath: 'docs/beta.md',
        addedAt: 1,
      }, true),
    );

    await waitFor(() => {
      expect(first.result.current).toBe('💡');
    });
    first.unmount();

    mocked.stat.mockResolvedValueOnce({ modifiedAt: 2, size: 48 });
    mocked.readFile.mockResolvedValueOnce('---\nvlaina_icon: "📘"\n---\n# Beta');

    const second = renderHook(() =>
      useStarredEntryIcon({
        id: 'starred-2',
        kind: 'note',
        vaultPath: '/vault-b',
        relativePath: 'docs/beta.md',
        addedAt: 1,
      }, true),
    );

    await waitFor(() => {
      expect(second.result.current).toBe('📘');
    });
    expect(mocked.readFile).toHaveBeenCalledTimes(2);
  });
});
