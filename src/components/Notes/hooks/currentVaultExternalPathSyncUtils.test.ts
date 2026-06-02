import { beforeEach, describe, expect, it, vi } from 'vitest';

const { adapter } = vi.hoisted(() => ({
  adapter: {
    exists: vi.fn<(path: string) => Promise<boolean>>(),
    readFile: vi.fn<(path: string) => Promise<string>>(),
    stat: vi.fn<(path: string) => Promise<{ isDirectory: boolean } | null>>(),
    listDir: vi.fn<(path: string) => Promise<Array<{ name: string; isDirectory: boolean }>>>(),
    getBasePath: vi.fn<() => Promise<string>>(),
  },
}));

vi.mock('@/lib/storage/adapter', () => ({
  getParentPath: (path: string) => {
    const normalized = path.replace(/\\/g, '/').replace(/\/+$/, '');
    const lastSlashIndex = normalized.lastIndexOf('/');
    if (lastSlashIndex === -1) return null;
    const parent = normalized.slice(0, lastSlashIndex) || '/';
    return path.includes('\\') ? parent.replace(/\//g, '\\') : parent;
  },
  getStorageAdapter: () => adapter,
  joinPath: (...segments: string[]) => Promise.resolve(segments.filter(Boolean).join('/')),
}));

import { isDirectChildPath, looksLikeVaultRoot } from './currentVaultExternalPathSyncUtils';

describe('currentVaultExternalPathSyncUtils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    adapter.getBasePath.mockResolvedValue('/app');
    adapter.stat.mockResolvedValue({ isDirectory: true });
  });

  it('accepts an existing directory as a vault root candidate', async () => {
    adapter.exists.mockResolvedValue(true);

    await expect(looksLikeVaultRoot('C:/vault-new')).resolves.toBe(true);
  });

  it('rejects missing paths as vault root candidates', async () => {
    adapter.exists.mockResolvedValue(false);

    await expect(looksLikeVaultRoot('C:/vault-new')).resolves.toBe(false);
  });

  it('matches Windows direct child paths case-insensitively', () => {
    expect(isDirectChildPath('C:\\Users\\Me', 'c:\\users\\me\\Vault')).toBe(true);
    expect(isDirectChildPath('C:\\Users\\Me', 'c:\\users\\other\\Vault')).toBe(false);
  });
});
