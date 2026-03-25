import { beforeEach, describe, expect, it, vi } from 'vitest';

const { storage } = vi.hoisted(() => ({
  storage: {
    exists: vi.fn<(path: string) => Promise<boolean>>(),
  },
}));

vi.mock('@/lib/storage/adapter', () => {
  const normalize = (path: string) => path.replace(/\\/g, '/');

  const getParentPath = (path: string): string | null => {
    const normalized = normalize(path);
    const parts = normalized.split('/').filter(Boolean);

    if (parts.length <= 1) {
      return null;
    }

    parts.pop();
    const parent = parts.join('/');

    if (path.includes('\\')) {
      return parent.replace(/\//g, '\\');
    }

    return parent.startsWith('/') ? parent : `/${parent}`;
  };

  const getBaseName = (path: string): string => {
    const parts = normalize(path).split('/').filter(Boolean);
    return parts[parts.length - 1] ?? '';
  };

  const getExtension = (path: string): string => {
    const name = getBaseName(path);
    const lastDot = name.lastIndexOf('.');
    if (lastDot === -1 || lastDot === 0) {
      return '';
    }
    return name.slice(lastDot + 1);
  };

  const relativePath = (from: string, to: string): string => {
    const fromNormalized = normalize(from).replace(/\/$/, '');
    const toNormalized = normalize(to);

    if (toNormalized.startsWith(`${fromNormalized}/`)) {
      return toNormalized.slice(fromNormalized.length + 1);
    }

    return toNormalized;
  };

  return {
    getStorageAdapter: () => storage,
    getParentPath,
    getBaseName,
    getExtension,
    relativePath,
    joinPath: (...segments: string[]) => Promise.resolve(segments.filter(Boolean).join('/')),
  };
});

import {
  getSingleOpenSelection,
  isSupportedMarkdownSelection,
  resolveOpenNoteTarget,
} from './openTargetSelection';

describe('openTargetSelection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('normalizes single dialog selections', () => {
    expect(getSingleOpenSelection(null)).toBeNull();
    expect(getSingleOpenSelection('/vault/docs/a.md')).toBe('/vault/docs/a.md');
    expect(getSingleOpenSelection(['/vault/docs/a.md', '/vault/docs/b.md'])).toBe('/vault/docs/a.md');
  });

  it('accepts supported Markdown extensions', () => {
    expect(isSupportedMarkdownSelection('/vault/docs/README.MD')).toBe(true);
    expect(isSupportedMarkdownSelection('/vault/docs/note.markdown')).toBe(true);
    expect(isSupportedMarkdownSelection('/vault/docs/data.txt')).toBe(false);
  });

  it('uses the nearest configured vault ancestor for Markdown files', async () => {
    storage.exists.mockImplementation(async (path: string) => {
      return path === '/vault/projects/.vlaina/store/config.json';
    });

    await expect(resolveOpenNoteTarget('/vault/projects/docs/a.md')).resolves.toEqual({
      vaultPath: '/vault/projects',
      notePath: 'docs/a.md',
    });
  });

  it('falls back to the parent folder when no vault config exists', async () => {
    storage.exists.mockResolvedValue(false);

    await expect(resolveOpenNoteTarget('/vault/docs/a.md')).resolves.toEqual({
      vaultPath: '/vault/docs',
      notePath: 'a.md',
    });
  });

  it('resolves Windows paths into vault-relative note paths', async () => {
    storage.exists.mockImplementation(async (path: string) => {
      return path === 'C:\\vault/.vlaina/store/config.json';
    });

    await expect(resolveOpenNoteTarget('C:\\vault\\docs\\a.md')).resolves.toEqual({
      vaultPath: 'C:\\vault',
      notePath: 'docs/a.md',
    });
  });
});
