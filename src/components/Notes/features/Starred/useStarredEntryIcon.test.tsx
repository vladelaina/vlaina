import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useStarredEntryIcon } from './useStarredEntryIcon';

const mocked = vi.hoisted(() => ({
  readFile: vi.fn(async () => ''),
}));

vi.mock('@/lib/storage/adapter', () => ({
  getStorageAdapter: () => ({
    readFile: mocked.readFile,
  }),
  joinPath: async (...segments: string[]) => segments.join('/').replace(/\/+/g, '/'),
}));

describe('useStarredEntryIcon', () => {
  beforeEach(() => {
    mocked.readFile.mockReset();
  });

  it('loads a starred note icon from its vault markdown frontmatter', async () => {
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
});
