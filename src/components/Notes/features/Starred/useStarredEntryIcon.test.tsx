import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useStarredEntryIcon } from './useStarredEntryIcon';

const MAX_STARRED_ICON_METADATA_BYTES = 512 * 1024;

const mocked = vi.hoisted(() => ({
  readFile: vi.fn(async () => ''),
  stat: vi.fn(async (): Promise<{ isFile?: boolean; isDirectory?: boolean; modifiedAt?: number; size?: number } | null> => null),
}));

vi.mock('@/lib/storage/adapter', () => ({
  getStorageAdapter: () => ({
    readFile: mocked.readFile,
    stat: mocked.stat,
  }),
  isAbsolutePath: (path: string) => path.startsWith('/') || /^[A-Za-z]:[\\/]/.test(path),
  joinPath: async (...segments: string[]) => segments.join('/').replace(/\/+/g, '/'),
  normalizeAbsolutePath: (path: string) => path.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/+$/, ''),
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
    expect(mocked.readFile).toHaveBeenCalledWith('/vault-b/docs/alpha.md', MAX_STARRED_ICON_METADATA_BYTES);
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

  it('does not reuse a cached starred note icon when stat has size but no modified time', async () => {
    mocked.stat.mockResolvedValueOnce({ size: 32 });
    mocked.readFile.mockResolvedValueOnce('---\nvlaina_icon: "💡"\n---\n# Alpha');

    const first = renderHook(() =>
      useStarredEntryIcon({
        id: 'starred-no-mtime',
        kind: 'note',
        vaultPath: '/vault-b',
        relativePath: 'docs/no-mtime.md',
        addedAt: 1,
      }, true),
    );

    await waitFor(() => {
      expect(first.result.current).toBe('💡');
    });
    first.unmount();

    mocked.stat.mockResolvedValueOnce({ size: 32 });
    mocked.readFile.mockResolvedValueOnce('---\nvlaina_icon: "📘"\n---\n# Alpha');

    const second = renderHook(() =>
      useStarredEntryIcon({
        id: 'starred-no-mtime',
        kind: 'note',
        vaultPath: '/vault-b',
        relativePath: 'docs/no-mtime.md',
        addedAt: 1,
      }, true),
    );

    expect(second.result.current).toBeUndefined();
    await waitFor(() => {
      expect(second.result.current).toBe('📘');
    });
    expect(mocked.readFile).toHaveBeenCalledTimes(2);
  });

  it('does not reuse a cached starred note icon when stat has an invalid modified time', async () => {
    mocked.stat.mockResolvedValueOnce({ modifiedAt: Number.POSITIVE_INFINITY, size: 32 });
    mocked.readFile.mockResolvedValueOnce('---\nvlaina_icon: "💡"\n---\n# Alpha');

    const first = renderHook(() =>
      useStarredEntryIcon({
        id: 'starred-invalid-mtime',
        kind: 'note',
        vaultPath: '/vault-b',
        relativePath: 'docs/invalid-mtime.md',
        addedAt: 1,
      }, true),
    );

    await waitFor(() => {
      expect(first.result.current).toBe('💡');
    });
    first.unmount();

    mocked.stat.mockResolvedValueOnce({ modifiedAt: Number.POSITIVE_INFINITY, size: 32 });
    mocked.readFile.mockResolvedValueOnce('---\nvlaina_icon: "📘"\n---\n# Alpha');

    const second = renderHook(() =>
      useStarredEntryIcon({
        id: 'starred-invalid-mtime',
        kind: 'note',
        vaultPath: '/vault-b',
        relativePath: 'docs/invalid-mtime.md',
        addedAt: 1,
      }, true),
    );

    expect(second.result.current).toBeUndefined();
    await waitFor(() => {
      expect(second.result.current).toBe('📘');
    });
    expect(mocked.readFile).toHaveBeenCalledTimes(2);
  });

  it('skips oversized starred note metadata reads', async () => {
    mocked.stat.mockResolvedValue({ modifiedAt: 1, size: 600 * 1024 });

    const { result } = renderHook(() =>
      useStarredEntryIcon({
        id: 'starred-large',
        kind: 'note',
        vaultPath: '/vault-b',
        relativePath: 'docs/large.md',
        addedAt: 1,
      }, true),
    );

    await waitFor(() => {
      expect(mocked.stat).toHaveBeenCalledWith('/vault-b/docs/large.md');
    });
    expect(result.current).toBeUndefined();
    expect(mocked.readFile).not.toHaveBeenCalled();
  });

  it('skips starred note metadata reads when stat reports an invalid negative size', async () => {
    mocked.stat.mockResolvedValue({ modifiedAt: 1, size: -1 });

    const { result } = renderHook(() =>
      useStarredEntryIcon({
        id: 'starred-invalid-size',
        kind: 'note',
        vaultPath: '/vault-b',
        relativePath: 'docs/invalid-size.md',
        addedAt: 1,
      }, true),
    );

    await waitFor(() => {
      expect(mocked.stat).toHaveBeenCalledWith('/vault-b/docs/invalid-size.md');
    });
    expect(result.current).toBeUndefined();
    expect(mocked.readFile).not.toHaveBeenCalled();
  });

  it('skips starred note metadata that exceeds the limit after read', async () => {
    mocked.stat.mockResolvedValue({ modifiedAt: 1, size: 32 });
    mocked.readFile.mockResolvedValue([
      '---',
      'vlaina_icon: "💡"',
      '---',
      '你'.repeat(Math.floor(MAX_STARRED_ICON_METADATA_BYTES / 3) + 1),
    ].join('\n'));

    const { result } = renderHook(() =>
      useStarredEntryIcon({
        id: 'starred-large-after-read',
        kind: 'note',
        vaultPath: '/vault-b',
        relativePath: 'docs/large-after-read.md',
        addedAt: 1,
      }, true),
    );

    await waitFor(() => {
      expect(mocked.readFile).toHaveBeenCalledWith(
        '/vault-b/docs/large-after-read.md',
        MAX_STARRED_ICON_METADATA_BYTES,
      );
    });
    expect(result.current).toBeUndefined();
  });

  it('skips starred note metadata reads when stat is unavailable', async () => {
    mocked.stat.mockResolvedValue(null);

    const { result } = renderHook(() =>
      useStarredEntryIcon({
        id: 'starred-missing-size',
        kind: 'note',
        vaultPath: '/vault-b',
        relativePath: 'docs/missing-size.md',
        addedAt: 1,
      }, true),
    );

    await waitFor(() => {
      expect(mocked.stat).toHaveBeenCalledWith('/vault-b/docs/missing-size.md');
    });
    expect(result.current).toBeUndefined();
    expect(mocked.readFile).not.toHaveBeenCalled();
  });

  it('loads starred note metadata with bounded reads when stat has no size', async () => {
    mocked.stat.mockResolvedValue({ isFile: true, isDirectory: false });
    mocked.readFile.mockResolvedValue('---\nvlaina_icon: "💡"\n---\n# Alpha');

    const { result } = renderHook(() =>
      useStarredEntryIcon({
        id: 'starred-no-size',
        kind: 'note',
        vaultPath: '/vault-b',
        relativePath: 'docs/no-size.md',
        addedAt: 1,
      }, true),
    );

    await waitFor(() => {
      expect(result.current).toBe('💡');
    });
    expect(mocked.readFile).toHaveBeenCalledWith('/vault-b/docs/no-size.md', MAX_STARRED_ICON_METADATA_BYTES);
  });

  it('does not read icon metadata from stale internal starred entries', async () => {
    const { result } = renderHook(() =>
      useStarredEntryIcon({
        id: 'starred-internal',
        kind: 'note',
        vaultPath: '/vault',
        relativePath: 'docs/.git/config.md',
        addedAt: 1,
      }, true),
    );

    await Promise.resolve();

    expect(result.current).toBeUndefined();
    expect(mocked.stat).not.toHaveBeenCalled();
    expect(mocked.readFile).not.toHaveBeenCalled();
  });

  it('does not read icon metadata from case-variant stale internal starred entries', async () => {
    const { result } = renderHook(() =>
      useStarredEntryIcon({
        id: 'starred-internal-uppercase',
        kind: 'note',
        vaultPath: '/vault',
        relativePath: 'docs/.GIT/config.md',
        addedAt: 1,
      }, true),
    );

    await Promise.resolve();

    expect(result.current).toBeUndefined();
    expect(mocked.stat).not.toHaveBeenCalled();
    expect(mocked.readFile).not.toHaveBeenCalled();
  });

  it('does not read icon metadata from stale entries with internal vault paths', async () => {
    const { result } = renderHook(() =>
      useStarredEntryIcon({
        id: 'starred-internal-vault',
        kind: 'note',
        vaultPath: '/vault/.vlaina',
        relativePath: 'workspace.md',
        addedAt: 1,
      }, true),
    );

    await Promise.resolve();

    expect(result.current).toBeUndefined();
    expect(mocked.stat).not.toHaveBeenCalled();
    expect(mocked.readFile).not.toHaveBeenCalled();
  });

  it('does not read icon metadata from stale entries with case-variant internal vault paths', async () => {
    const { result } = renderHook(() =>
      useStarredEntryIcon({
        id: 'starred-internal-vault-uppercase',
        kind: 'note',
        vaultPath: '/vault/.VLAINA',
        relativePath: 'workspace.md',
        addedAt: 1,
      }, true),
    );

    await Promise.resolve();

    expect(result.current).toBeUndefined();
    expect(mocked.stat).not.toHaveBeenCalled();
    expect(mocked.readFile).not.toHaveBeenCalled();
  });

  it('does not read icon metadata from stale non-markdown starred note entries', async () => {
    const { result } = renderHook(() =>
      useStarredEntryIcon({
        id: 'starred-non-markdown',
        kind: 'note',
        vaultPath: '/vault',
        relativePath: 'docs/secret.txt',
        addedAt: 1,
      }, true),
    );

    await Promise.resolve();

    expect(result.current).toBeUndefined();
    expect(mocked.stat).not.toHaveBeenCalled();
    expect(mocked.readFile).not.toHaveBeenCalled();
  });

  it('limits concurrent starred note metadata reads', async () => {
    const pendingReads: Array<() => void> = [];
    mocked.stat.mockResolvedValue({ modifiedAt: 1, size: 32 });
    mocked.readFile.mockImplementation(async () => {
      await new Promise<void>((resolve) => {
        pendingReads.push(resolve);
      });
      return '---\nvlaina_icon: "💡"\n---\n# Alpha';
    });

    const hooks = Array.from({ length: 8 }, (_, index) =>
      renderHook(() =>
        useStarredEntryIcon({
          id: `starred-concurrent-${index}`,
          kind: 'note',
          vaultPath: '/vault-b',
          relativePath: `docs/concurrent-${index}.md`,
          addedAt: 1,
        }, true),
      )
    );

    await waitFor(() => {
      expect(mocked.readFile).toHaveBeenCalledTimes(4);
    });

    await act(async () => {
      pendingReads.splice(0).forEach((resolve) => resolve());
    });
    await waitFor(() => {
      expect(mocked.readFile).toHaveBeenCalledTimes(8);
    });

    await act(async () => {
      pendingReads.splice(0).forEach((resolve) => resolve());
      await Promise.resolve();
      await Promise.resolve();
    });

    hooks.forEach((hook) => hook.unmount());
  });

  it('cancels queued starred note metadata reads after unmount', async () => {
    const pendingReads: Array<() => void> = [];
    mocked.stat.mockResolvedValue({ modifiedAt: 1, size: 32 });
    mocked.readFile.mockImplementation(async () => {
      await new Promise<void>((resolve) => {
        pendingReads.push(resolve);
      });
      return '---\nvlaina_icon: "💡"\n---\n# Alpha';
    });

    const hooks = Array.from({ length: 8 }, (_, index) =>
      renderHook(() =>
        useStarredEntryIcon({
          id: `starred-cancel-${index}`,
          kind: 'note',
          vaultPath: '/vault-b',
          relativePath: `docs/cancel-${index}.md`,
          addedAt: 1,
        }, true),
      )
    );

    await waitFor(() => {
      expect(mocked.readFile).toHaveBeenCalledTimes(4);
    });

    hooks.forEach((hook) => hook.unmount());
    pendingReads.splice(0).forEach((resolve) => resolve());
    await Promise.resolve();
    await Promise.resolve();

    expect(mocked.readFile).toHaveBeenCalledTimes(4);
  });
});
