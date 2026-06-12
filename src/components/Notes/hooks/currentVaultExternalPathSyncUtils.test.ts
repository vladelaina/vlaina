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
  isAbsolutePath: (path: string) => (
    /^\\\\[^\\]+\\[^\\]+/.test(path) ||
    /^[A-Za-z]:[\\/]/.test(path) ||
    path.startsWith('/')
  ),
  joinPath: (...segments: string[]) => Promise.resolve(segments.filter(Boolean).join('/')),
  normalizeAbsolutePath: (path: string) => {
    const normalized = path.replace(/\\/g, '/');
    const driveMatch = normalized.match(/^([A-Za-z]:)(?:\/|$)/);
    const root = driveMatch ? `${driveMatch[1]}/` : normalized.startsWith('/') ? '/' : '';
    if (!root) return path;

    const parts: string[] = [];
    const rest = normalized.slice(root.length).replace(/^\/+/, '');
    for (const part of rest.split('/')) {
      if (!part || part === '.') continue;
      if (part === '..') {
        parts.pop();
        continue;
      }
      parts.push(part);
    }

    const nextPath = parts.length > 0
      ? `${root}${root.endsWith('/') ? '' : '/'}${parts.join('/')}`
      : root;
    return path.includes('\\') ? nextPath.replace(/\//g, '\\') : nextPath;
  },
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

  it('rejects unsafe and relative vault root candidates before probing storage', async () => {
    await expect(looksLikeVaultRoot('relative/vault')).resolves.toBe(false);
    await expect(looksLikeVaultRoot('/home/user/unsafe\u202Egnp')).resolves.toBe(false);

    expect(adapter.exists).not.toHaveBeenCalled();
    expect(adapter.stat).not.toHaveBeenCalled();
  });

  it('probes normalized vault root candidates', async () => {
    adapter.exists.mockResolvedValue(true);

    await expect(looksLikeVaultRoot('/home/user/vault/../vault-new')).resolves.toBe(true);

    expect(adapter.exists).toHaveBeenCalledWith('/home/user/vault-new');
    expect(adapter.stat).toHaveBeenCalledWith('/home/user/vault-new');
  });

  it('matches Windows direct child paths case-insensitively', () => {
    expect(isDirectChildPath('C:\\Users\\Me', 'c:\\users\\me\\Vault')).toBe(true);
    expect(isDirectChildPath('C:\\Users\\Me', 'c:\\users\\other\\Vault')).toBe(false);
  });

  it('normalizes dot segments before matching direct child paths', () => {
    expect(isDirectChildPath('/home/user', '/home/user/vault/../vault-new')).toBe(true);
    expect(isDirectChildPath('/home/user', '/home/user/vault/../../other')).toBe(false);
  });
});
