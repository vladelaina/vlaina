import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ensureVaultConfig } from './vaultConfig';

const adapter = {
  exists: vi.fn<(path: string) => Promise<boolean>>(),
  readFile: vi.fn<(path: string, maxBytes?: number) => Promise<string>>(),
  stat: vi.fn<(path: string) => Promise<{ size?: number } | null>>(),
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
    adapter.stat.mockResolvedValue(null);
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
    adapter.stat.mockResolvedValue({ size: 64 });
    adapter.readFile.mockResolvedValue(JSON.stringify({ version: 1, created: 100, vaultPath: '/old' }));

    await ensureVaultConfig('/vault');

    expect(adapter.writeFile).toHaveBeenCalledWith(
      '/app/.vlaina/store/notes/vaults/vault-1y3s8he/config.json',
      JSON.stringify({ version: 1, created: 100, vaultPath: '/vault' }, null, 2)
    );
  });

  it('repairs invalid existing config content', async () => {
    adapter.exists.mockResolvedValue(true);
    adapter.stat.mockResolvedValue({ size: 8 });
    adapter.readFile.mockResolvedValue('not-json');

    await ensureVaultConfig('/vault');

    expect(adapter.writeFile).toHaveBeenCalledWith(
      '/app/.vlaina/store/notes/vaults/vault-1y3s8he/config.json',
      JSON.stringify({ version: 1, created: 1234, vaultPath: '/vault' }, null, 2)
    );
  });

  it('repairs oversized existing config content without reading it', async () => {
    adapter.exists.mockResolvedValue(true);
    adapter.stat.mockResolvedValue({ size: 100 * 1024 });

    await ensureVaultConfig('/vault');

    expect(adapter.readFile).not.toHaveBeenCalled();
    expect(adapter.writeFile).toHaveBeenCalledWith(
      '/app/.vlaina/store/notes/vaults/vault-1y3s8he/config.json',
      JSON.stringify({ version: 1, created: 1234, vaultPath: '/vault' }, null, 2)
    );
  });

  it('repairs existing config content when stat has no size', async () => {
    adapter.exists.mockResolvedValue(true);
    adapter.stat.mockResolvedValue({});

    await ensureVaultConfig('/vault');

    expect(adapter.readFile).not.toHaveBeenCalled();
    expect(adapter.writeFile).toHaveBeenCalledWith(
      '/app/.vlaina/store/notes/vaults/vault-1y3s8he/config.json',
      JSON.stringify({ version: 1, created: 1234, vaultPath: '/vault' }, null, 2)
    );
  });

  it('repairs existing config content that exceeds the limit after read', async () => {
    adapter.exists.mockResolvedValue(true);
    adapter.stat.mockResolvedValue({ size: 64 });
    adapter.readFile.mockResolvedValue('x'.repeat(64 * 1024 + 1));

    await ensureVaultConfig('/vault');

    expect(adapter.readFile).toHaveBeenCalledWith(
      '/app/.vlaina/store/notes/vaults/vault-1y3s8he/config.json',
      64 * 1024,
    );
    expect(adapter.writeFile).toHaveBeenCalledWith(
      '/app/.vlaina/store/notes/vaults/vault-1y3s8he/config.json',
      JSON.stringify({ version: 1, created: 1234, vaultPath: '/vault' }, null, 2)
    );
  });
});
