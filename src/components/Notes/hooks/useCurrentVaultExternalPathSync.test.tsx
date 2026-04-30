import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCurrentVaultExternalPathSync } from './useCurrentVaultExternalPathSync';

const hoisted = vi.hoisted(() => ({
  syncCurrentVaultExternalPath: vi.fn(),
  watchDesktopPath: vi.fn(async () => vi.fn(async () => undefined)),
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
  findRenamedVaultPathBySignature: vi.fn(async () => null),
  getVaultExternalWatchPaths: vi.fn(() => ({
    normalizedVaultPath: '/home/user/vault',
    normalizedParentPath: '/home/user',
    watchParentPath: '/home/user',
  })),
  isDirectChildPath: vi.fn(() => true),
  looksLikeVaultRoot: vi.fn(async () => true),
  readVaultConfigSignature: vi.fn(async () => 'signature'),
}));

vi.mock('./notesExternalSyncUtils', () => ({
  getAbsoluteRenameWatchPaths: vi.fn(() => null),
  isCreateWatchEvent: vi.fn(() => false),
  isRemoveWatchEvent: vi.fn(() => false),
  normalizeFsPath: (path: string) => path,
}));

describe('useCurrentVaultExternalPathSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});
