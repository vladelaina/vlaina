import { describe, expect, it, vi } from 'vitest';

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

  return {
    getParentPath,
    getBaseName,
    getExtension,
  };
});

import {
  getSingleOpenSelection,
  isSupportedMarkdownSelection,
  resolveOpenNoteTarget,
} from './openTargetSelection';

describe('openTargetSelection', () => {
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

  it('uses the selected file parent folder as the opened vault', () => {
    expect(resolveOpenNoteTarget('/vault/projects/docs/a.md')).toEqual({
      vaultPath: '/vault/projects/docs',
      notePath: 'a.md',
    });
  });

  it('falls back to the parent folder when opening a file at the vault root', () => {
    expect(resolveOpenNoteTarget('/vault/docs/a.md')).toEqual({
      vaultPath: '/vault/docs',
      notePath: 'a.md',
    });
  });

  it('resolves Windows paths using the selected file parent folder', () => {
    expect(resolveOpenNoteTarget('C:\\vault\\docs\\a.md')).toEqual({
      vaultPath: 'C:\\vault\\docs',
      notePath: 'a.md',
    });
  });
});
