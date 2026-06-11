import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCurrentVaultExternalPathSync } from './useCurrentVaultExternalPathSync';

type WatchEvent = {
  type: unknown;
  paths: string[];
};

const hoisted = vi.hoisted(() => ({
  syncCurrentVaultExternalPath: vi.fn(),
  watchHandler: null as ((event: WatchEvent) => void | Promise<void>) | null,
  watchPaths: {
    normalizedVaultPath: '/home/user/vault',
    normalizedParentPath: '/home/user',
    watchParentPath: '/home/user',
  },
  renamePaths: null as { oldPath: string | null; newPath: string | null } | null,
  watchDesktopPath: vi.fn(async (_path: string, handler: (event: WatchEvent) => void | Promise<void>) => {
    hoisted.watchHandler = handler;
    return vi.fn(async () => undefined);
  }),
  releaseWatcher: vi.fn(),
}));

vi.mock('@/lib/desktop/watch', () => ({
  watchDesktopPath: hoisted.watchDesktopPath,
}));

vi.mock('@/stores/vaultConfig', () => ({
  ensureVaultConfig: vi.fn(async () => undefined),
}));

vi.mock('@/stores/useVaultStore', () => ({
  useVaultStore: (selector: (state: { syncCurrentVaultExternalPath: typeof hoisted.syncCurrentVaultExternalPath }) => unknown) =>
    selector({ syncCurrentVaultExternalPath: hoisted.syncCurrentVaultExternalPath }),
}));

vi.mock('@/stores/notes/document/externalSyncControl', () => ({
  isExternalSyncPaused: vi.fn(() => false),
  subscribeExternalSyncPause: vi.fn(() => () => {}),
  registerExternalSyncWatcher: vi.fn(() => hoisted.releaseWatcher),
}));

vi.mock('@/stores/notes/document/externalChangeRegistry', () => ({
  shouldIgnoreExpectedExternalChange: vi.fn(() => false),
}));

vi.mock('./currentVaultExternalPathSyncUtils', () => ({
  getVaultExternalWatchPaths: vi.fn(() => hoisted.watchPaths),
  isDirectChildPath: vi.fn(() => true),
  looksLikeVaultRoot: vi.fn(async () => true),
}));

vi.mock('./notesExternalSyncUtils', () => ({
  getAbsoluteRenameWatchPaths: vi.fn(() => hoisted.renamePaths),
  getFsPathComparisonKey: (path: string) => (
    /^[a-z]:\//i.test(path) || path.startsWith('//') ? path.toLowerCase() : path
  ),
  isCreateWatchEvent: (event: WatchEvent) =>
    typeof event.type === 'object' && event.type !== null && 'create' in event.type,
  isRemoveWatchEvent: (event: WatchEvent) =>
    typeof event.type === 'object' && event.type !== null && 'remove' in event.type,
  normalizeFsPath: (path: string) => path.replace(/\\/g, '/'),
}));

describe('useCurrentVaultExternalPathSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.watchHandler = null;
    hoisted.watchPaths = {
      normalizedVaultPath: '/home/user/vault',
      normalizedParentPath: '/home/user',
      watchParentPath: '/home/user',
    };
    hoisted.renamePaths = null;
  });

  it('watches the vault parent directory non-recursively', async () => {
    renderHook(() => useCurrentVaultExternalPathSync('/home/user/vault'));

    await act(async () => {
      await Promise.resolve();
    });

    expect(hoisted.watchDesktopPath).toHaveBeenCalledWith(
      '/home/user',
      expect.any(Function),
      { recursive: false }
    );
  });

  it('syncs a Windows vault rename when watcher paths differ only by case', async () => {
    hoisted.watchPaths = {
      normalizedVaultPath: 'C:/Users/Me/Vault',
      normalizedParentPath: 'C:/Users/Me',
      watchParentPath: 'C:/Users/Me',
    };
    hoisted.renamePaths = {
      oldPath: 'c:/users/me/vault',
      newPath: 'c:/users/me/vault-renamed',
    };

    renderHook(() => useCurrentVaultExternalPathSync('C:/Users/Me/Vault'));

    await act(async () => {
      await Promise.resolve();
      await hoisted.watchHandler?.({
        type: { modify: { kind: 'rename', mode: 'both' } },
        paths: ['c:/users/me/vault', 'c:/users/me/vault-renamed'],
      });
    });

    expect(hoisted.syncCurrentVaultExternalPath).toHaveBeenCalledWith('c:/users/me/vault-renamed');
  });

  it('matches split Windows vault remove and create events case-insensitively', async () => {
    hoisted.watchPaths = {
      normalizedVaultPath: 'C:/Users/Me/Vault',
      normalizedParentPath: 'C:/Users/Me',
      watchParentPath: 'C:/Users/Me',
    };

    renderHook(() => useCurrentVaultExternalPathSync('C:/Users/Me/Vault'));

    await act(async () => {
      await Promise.resolve();
      await hoisted.watchHandler?.({
        type: { remove: { kind: 'folder' } },
        paths: ['c:/users/me/vault'],
      });
      await hoisted.watchHandler?.({
        type: { create: { kind: 'folder' } },
        paths: ['c:/users/me/vault-renamed'],
      });
    });

    expect(hoisted.syncCurrentVaultExternalPath).toHaveBeenCalledWith('c:/users/me/vault-renamed');
  });
});
