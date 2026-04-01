import { beforeEach, describe, expect, it, vi } from 'vitest';

const { adapter } = vi.hoisted(() => ({
  adapter: {
    exists: vi.fn<(path: string) => Promise<boolean>>(),
    readFile: vi.fn<(path: string) => Promise<string>>(),
    listDir: vi.fn<(path: string) => Promise<Array<{ name: string; isDirectory: boolean }>>>(),
  },
}));

vi.mock('@/lib/storage/adapter', () => ({
  getStorageAdapter: () => adapter,
  joinPath: (...segments: string[]) => Promise.resolve(segments.filter(Boolean).join('/')),
}));

import {
  findRenamedVaultPathBySignature,
  readVaultConfigSignature,
} from './currentVaultExternalPathSyncUtils';

describe('currentVaultExternalPathSyncUtils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reads the current vault config signature', async () => {
    adapter.exists.mockResolvedValue(true);
    adapter.readFile.mockResolvedValue('{"version":1,"created":123}');

    await expect(readVaultConfigSignature('C:/vault-old')).resolves.toBe('{"version":1,"created":123}');
  });

  it('finds a renamed vault by matching config signature under the parent folder', async () => {
    adapter.exists.mockImplementation(async (path: string) => path !== 'C:/vault-old');
    adapter.listDir.mockResolvedValue([
      { name: 'vault-new', isDirectory: true },
      { name: 'other', isDirectory: true },
    ]);
    adapter.readFile.mockImplementation(async (path: string) => {
      if (path === 'C:/parent/vault-new/.vlaina/store/config.json') {
        return '{"version":1,"created":123}';
      }
      if (path === 'C:/parent/other/.vlaina/store/config.json') {
        return '{"version":1,"created":999}';
      }
      return '';
    });

    await expect(
      findRenamedVaultPathBySignature('C:/parent', 'C:/vault-old', '{"version":1,"created":123}')
    ).resolves.toBe('C:/parent/vault-new');
  });
});
