import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ensureVaultConfig } from './vaultConfig';

const adapter = {
  exists: vi.fn<(path: string) => Promise<boolean>>(),
  readFile: vi.fn<(path: string) => Promise<string>>(),
  writeFile: vi.fn<(path: string, content: string) => Promise<void>>(),
  mkdir: vi.fn<(path: string, recursive?: boolean) => Promise<void>>(),
  getBasePath: vi.fn<() => Promise<string>>(),
};

vi.mock('@/lib/storage/adapter', () => ({
  getStorageAdapter: () => adapter,
  joinPath: (...segments: string[]) => Promise.resolve(segments.filter(Boolean).join('/')),
}));

describe('vaultConfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Date, 'now').mockReturnValue(1234);
    adapter.exists.mockResolvedValue(false);
    adapter.readFile.mockResolvedValue('{}');
    adapter.writeFile.mockResolvedValue(undefined);
    adapter.mkdir.mockResolvedValue(undefined);
    adapter.getBasePath.mockResolvedValue('/app');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates vault config in the system store', async () => {
    await ensureVaultConfig('/vault');

    expect(adapter.mkdir).toHaveBeenCalledWith('/app/.vlaina/store/notes/vaults/vault-1y3s8he', true);
    expect(adapter.writeFile).toHaveBeenCalledWith(
      '/app/.vlaina/store/notes/vaults/vault-1y3s8he/config.json',
      JSON.stringify({ version: 1, created: 1234, vaultPath: '/vault' }, null, 2)
    );
  });

  it('updates stale vaultPath in an existing config', async () => {
    adapter.exists.mockResolvedValue(true);
    adapter.readFile.mockResolvedValue(JSON.stringify({ version: 1, created: 100, vaultPath: '/old' }));

    await ensureVaultConfig('/vault');

    expect(adapter.writeFile).toHaveBeenCalledWith(
      '/app/.vlaina/store/notes/vaults/vault-1y3s8he/config.json',
      JSON.stringify({ version: 1, created: 100, vaultPath: '/vault' }, null, 2)
    );
  });

  it('repairs invalid existing config content', async () => {
    adapter.exists.mockResolvedValue(true);
    adapter.readFile.mockResolvedValue('not-json');

    await ensureVaultConfig('/vault');

    expect(adapter.writeFile).toHaveBeenCalledWith(
      '/app/.vlaina/store/notes/vaults/vault-1y3s8he/config.json',
      JSON.stringify({ version: 1, created: 1234, vaultPath: '/vault' }, null, 2)
    );
  });
});
