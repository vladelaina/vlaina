import { afterEach, describe, expect, it, vi } from 'vitest';

describe('vaultStoreSupport broadcast channel guards', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('does not throw when BroadcastChannel construction fails', async () => {
    vi.stubGlobal('BroadcastChannel', class {
      constructor() {
        throw new Error('broadcast unavailable');
      }
    });
    const { setupBroadcastChannel } = await import('./vaultStoreSupport');

    expect(() => setupBroadcastChannel()).not.toThrow();
  });

  it('resolves vault-open queries when BroadcastChannel postMessage fails', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('BroadcastChannel', class {
      onmessage: ((event: MessageEvent) => void) | null = null;
      postMessage() {
        throw new Error('post failed');
      }
      close() {}
    });
    const { queryVaultOpenInOtherWindow } = await import('./vaultStoreSupport');

    const query = queryVaultOpenInOtherWindow('/vault');
    await vi.advanceTimersByTimeAsync(200);

    await expect(query).resolves.toBeNull();
  });
});

describe('vaultStoreSupport persistence merging', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.resetModules();
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('preserves recent vaults added by another window during a stale file save', async () => {
    vi.useFakeTimers();
    const storage = {
      getBasePath: vi.fn(async () => '/app'),
      exists: vi.fn(async (path: string) => path === '/app/.vlaina/store/vault-state.json'),
      readFile: vi.fn(async () => JSON.stringify({
        version: 1,
        recentVaults: [
          { id: 'vault-other', name: 'Other', path: '/vault/other', lastOpened: 2 },
        ],
        currentVaultId: 'vault-other',
        deletedVaultPaths: [],
      })),
      stat: vi.fn(async () => ({ size: 256 })),
      writeFile: vi.fn(async () => undefined),
      mkdir: vi.fn(async () => undefined),
    };
    vi.doMock('@/lib/storage/adapter', () => ({
      getStorageAdapter: () => storage,
      joinPath: (...segments: string[]) => Promise.resolve(segments.join('/')),
      getBaseName: (path: string) => path.split('/').pop() || '',
      getParentPath: (path: string) => path.split('/').slice(0, -1).join('/'),
    }));
    vi.doMock('@/lib/storage/paths', () => ({
      ensureDirectories: () => Promise.resolve(),
      getPaths: () => Promise.resolve({ store: '/app/.vlaina/store' }),
    }));

    const { persistVaultState } = await import('./vaultStoreSupport');
    persistVaultState([
      { id: 'vault-local', name: 'Local', path: '/vault/local', lastOpened: 1 },
    ], 'vault-local');

    await vi.runAllTimersAsync();
    await Promise.resolve();

    const writeCalls = storage.writeFile.mock.calls as unknown as Array<[string, string]>;
    const payload = JSON.parse(String(writeCalls[0]?.[1]));
    expect(payload.recentVaults.map((vault: { id: string }) => vault.id)).toEqual([
      'vault-local',
      'vault-other',
    ]);
    expect(payload.currentVaultId).toBe('vault-local');
  });

  it('does not resurrect a vault explicitly removed from recent list', async () => {
    vi.useFakeTimers();
    const removedVault = { id: 'vault-removed', name: 'Removed', path: '/vault/removed', lastOpened: 1 };
    const storage = {
      getBasePath: vi.fn(async () => '/app'),
      exists: vi.fn(async (path: string) => path === '/app/.vlaina/store/vault-state.json'),
      readFile: vi.fn(async () => JSON.stringify({
        version: 1,
        recentVaults: [removedVault],
        currentVaultId: 'vault-removed',
        deletedVaultPaths: [],
      })),
      stat: vi.fn(async () => ({ size: 256 })),
      writeFile: vi.fn(async () => undefined),
      mkdir: vi.fn(async () => undefined),
    };
    vi.doMock('@/lib/storage/adapter', () => ({
      getStorageAdapter: () => storage,
      joinPath: (...segments: string[]) => Promise.resolve(segments.join('/')),
      getBaseName: (path: string) => path.split('/').pop() || '',
      getParentPath: (path: string) => path.split('/').slice(0, -1).join('/'),
    }));
    vi.doMock('@/lib/storage/paths', () => ({
      ensureDirectories: () => Promise.resolve(),
      getPaths: () => Promise.resolve({ store: '/app/.vlaina/store' }),
    }));

    const { removeRecentVaultAction } = await import('./vaultStoreSupport');
    removeRecentVaultAction({
      id: removedVault.id,
      recentVaults: [removedVault],
      currentVault: removedVault,
      set: vi.fn(),
    });

    await vi.runAllTimersAsync();
    await Promise.resolve();

    const writeCalls = storage.writeFile.mock.calls as unknown as Array<[string, string]>;
    const payload = JSON.parse(String(writeCalls[0]?.[1]));
    expect(payload.recentVaults).toEqual([]);
    expect(payload.deletedVaultPaths).toEqual(['/vault/removed']);
    expect(payload.currentVaultId).toBeNull();
  });

  it('does not read vault state files when stat has no size', async () => {
    vi.useFakeTimers();
    const storage = {
      getBasePath: vi.fn(async () => '/app'),
      exists: vi.fn(async (path: string) => path === '/app/.vlaina/store/vault-state.json'),
      readFile: vi.fn(async () => JSON.stringify({
        version: 1,
        recentVaults: [
          { id: 'vault-other', name: 'Other', path: '/vault/other', lastOpened: 2 },
        ],
        currentVaultId: 'vault-other',
        deletedVaultPaths: [],
      })),
      stat: vi.fn(async () => ({})),
      writeFile: vi.fn(async () => undefined),
      mkdir: vi.fn(async () => undefined),
    };
    vi.doMock('@/lib/storage/adapter', () => ({
      getStorageAdapter: () => storage,
      joinPath: (...segments: string[]) => Promise.resolve(segments.join('/')),
      getBaseName: (path: string) => path.split('/').pop() || '',
      getParentPath: (path: string) => path.split('/').slice(0, -1).join('/'),
    }));
    vi.doMock('@/lib/storage/paths', () => ({
      ensureDirectories: () => Promise.resolve(),
      getPaths: () => Promise.resolve({ store: '/app/.vlaina/store' }),
    }));

    const { loadPersistedVaultState } = await import('./vaultStoreSupport');
    const state = await loadPersistedVaultState();

    expect(state.recentVaults).toEqual([]);
    expect(storage.readFile).not.toHaveBeenCalled();
  });
});

describe('vaultStoreSupport local storage guards', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not parse oversized recent vault storage values', async () => {
    const parseSpy = vi.spyOn(JSON, 'parse');
    const { parseRecentVaultsStorageValue } = await import('./vaultStoreSupport');

    expect(parseRecentVaultsStorageValue('['.padEnd(70 * 1024, ' '))).toEqual([]);
    expect(parseSpy).not.toHaveBeenCalled();
  });

  it('skips malformed recent vault entries without dropping valid entries', async () => {
    const { parseRecentVaultsStorageValue } = await import('./vaultStoreSupport');

    expect(parseRecentVaultsStorageValue(JSON.stringify([
      { id: 'vault-a', name: 'A', path: '/vault/a', lastOpened: 1 },
      null,
      { id: 'vault-bad', name: 'Bad', path: 42, lastOpened: 2 },
      { id: 'vault-b', name: 'B', path: '/vault/b', lastOpened: 3 },
    ]))).toEqual([
      { id: 'vault-a', name: 'A', path: '/vault/a', lastOpened: 1 },
      { id: 'vault-b', name: 'B', path: '/vault/b', lastOpened: 3 },
    ]);
  });

  it('rejects overlong recent vault paths before normalization', async () => {
    const { parseRecentVaultsStorageValue } = await import('./vaultStoreSupport');

    expect(parseRecentVaultsStorageValue(JSON.stringify([
      { id: 'vault-a', name: 'A', path: `/vault/${'a'.repeat(4096)}`, lastOpened: 1 },
      { id: 'vault-b', name: 'B', path: '/vault/b', lastOpened: 2 },
    ]))).toEqual([
      { id: 'vault-b', name: 'B', path: '/vault/b', lastOpened: 2 },
    ]);
  });
});
