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

import { isDirectChildPath, looksLikeNotesRootRoot } from './currentNotesRootExternalPathSyncUtils';

describe('currentNotesRootExternalPathSyncUtils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    adapter.getBasePath.mockResolvedValue('/app');
    adapter.stat.mockResolvedValue({ isDirectory: true });
  });

  it('accepts an existing directory as a notesRoot root candidate', async () => {
    adapter.exists.mockResolvedValue(true);

    await expect(looksLikeNotesRootRoot('C:/notes-root-new')).resolves.toBe(true);
  });

  it('rejects missing paths as notesRoot root candidates', async () => {
    adapter.exists.mockResolvedValue(false);

    await expect(looksLikeNotesRootRoot('C:/notes-root-new')).resolves.toBe(false);
  });

  it('rejects unsafe and relative notesRoot root candidates before probing storage', async () => {
    await expect(looksLikeNotesRootRoot('relative/notesRoot')).resolves.toBe(false);
    await expect(looksLikeNotesRootRoot('/home/user/unsafe\u202Egnp')).resolves.toBe(false);

    expect(adapter.exists).not.toHaveBeenCalled();
    expect(adapter.stat).not.toHaveBeenCalled();
  });

  it('probes normalized notesRoot root candidates', async () => {
    adapter.exists.mockResolvedValue(true);

    await expect(looksLikeNotesRootRoot('/home/user/notesRoot/../notes-root-new')).resolves.toBe(true);

    expect(adapter.exists).toHaveBeenCalledWith('/home/user/notes-root-new');
    expect(adapter.stat).toHaveBeenCalledWith('/home/user/notes-root-new');
  });

  it('matches Windows direct child paths case-insensitively', () => {
    expect(isDirectChildPath('C:\\Users\\Me', 'c:\\users\\me\\NotesRoot')).toBe(true);
    expect(isDirectChildPath('C:\\Users\\Me', 'c:\\users\\other\\NotesRoot')).toBe(false);
  });

  it('normalizes dot segments before matching direct child paths', () => {
    expect(isDirectChildPath('/home/user', '/home/user/notesRoot/../notes-root-new')).toBe(true);
    expect(isDirectChildPath('/home/user', '/home/user/notesRoot/../../other')).toBe(false);
  });
});
