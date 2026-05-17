import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useExternalStarredRenameSync } from './useExternalStarredRenameSync';

type WatchEvent = {
  type: unknown;
  paths: string[];
};

const mocked = vi.hoisted(() => {
  const notesState = {
    starredEntries: [] as Array<{
      id: string;
      kind: 'note' | 'folder';
      vaultPath: string;
      relativePath: string;
      addedAt: number;
    }>,
    applyExternalPathRename: vi.fn(async () => undefined),
  };
  const vaultState = {
    currentVault: { path: '/vault-a' } as { path: string } | null,
  };
  return {
    notesState,
    vaultState,
    handlers: new Map<string, (event: WatchEvent) => void | Promise<void>>(),
    unwatch: vi.fn(async () => undefined),
    watchDesktopPath: vi.fn(async (path: string, handler: (event: WatchEvent) => void | Promise<void>) => {
      mocked.handlers.set(path, handler);
      return mocked.unwatch;
    }),
  };
});

vi.mock('@/lib/desktop/watch', () => ({
  watchDesktopPath: mocked.watchDesktopPath,
}));

vi.mock('@/lib/storage/adapter', () => ({
  getBaseName: (path: string) => path.replace(/\\/g, '/').split('/').filter(Boolean).at(-1) ?? '',
  getParentPath: (path: string) => {
    const normalized = path.replace(/\\/g, '/').replace(/\/+$/, '');
    const index = normalized.lastIndexOf('/');
    return index > 0 ? normalized.slice(0, index) : null;
  },
  isAbsolutePath: (path: string) => path.startsWith('/'),
  normalizePath: (path: string) => path.replace(/\\/g, '/').replace(/\/+/g, '/'),
}));

vi.mock('@/stores/useNotesStore', () => ({
  useNotesStore: (selector: (state: typeof mocked.notesState) => unknown) => selector(mocked.notesState),
}));

vi.mock('@/stores/useVaultStore', () => ({
  useVaultStore: (selector: (state: typeof mocked.vaultState) => unknown) => selector(mocked.vaultState),
}));

describe('useExternalStarredRenameSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.handlers.clear();
    mocked.vaultState.currentVault = { path: '/vault-a' };
    mocked.notesState.starredEntries = [];
  });

  it('watches external starred notes and remaps renamed files', async () => {
    mocked.notesState.starredEntries = [
      {
        id: 'starred-external',
        kind: 'note',
        vaultPath: '/vault-b',
        relativePath: 'docs/alpha.md',
        addedAt: 1,
      },
    ];

    renderHook(() => useExternalStarredRenameSync());

    expect(mocked.watchDesktopPath).toHaveBeenCalledWith(
      '/vault-b/docs/alpha.md',
      expect.any(Function),
      { recursive: false },
    );

    await act(async () => {
      await mocked.handlers.get('/vault-b/docs/alpha.md')?.({
        type: { modify: { kind: 'rename', mode: 'both' } },
        paths: ['/vault-b/docs/alpha.md', '/vault-b/docs/beta.md'],
      });
    });

    expect(mocked.notesState.applyExternalPathRename).toHaveBeenCalledWith(
      '/vault-b/docs/alpha.md',
      '/vault-b/docs/beta.md',
    );
  });

  it('does not duplicate the current vault watcher for current-vault starred notes', () => {
    mocked.notesState.starredEntries = [
      {
        id: 'starred-current',
        kind: 'note',
        vaultPath: '/vault-a',
        relativePath: 'docs/alpha.md',
        addedAt: 1,
      },
    ];

    renderHook(() => useExternalStarredRenameSync());

    expect(mocked.watchDesktopPath).not.toHaveBeenCalled();
  });
});
