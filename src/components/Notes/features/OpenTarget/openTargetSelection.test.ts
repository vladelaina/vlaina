import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/storage/adapter', () => {
  const normalize = (path: string) => path.replace(/\\/g, '/');
  const getUncRoot = (normalizedPath: string): string | null => {
    if (!normalizedPath.startsWith('//') || normalizedPath.startsWith('///')) {
      return null;
    }

    const serverEnd = normalizedPath.indexOf('/', 2);
    if (serverEnd === -1) {
      return null;
    }

    const shareStart = serverEnd + 1;
    const shareEnd = normalizedPath.indexOf('/', shareStart);
    const share = shareEnd === -1
      ? normalizedPath.slice(shareStart)
      : normalizedPath.slice(shareStart, shareEnd);

    if (!share) {
      return null;
    }

    return shareEnd === -1 ? normalizedPath : normalizedPath.slice(0, shareEnd);
  };

  const normalizeAbsolutePath = (path: string): string => {
    const normalized = normalize(path);
    const uncRoot = getUncRoot(normalized);
    const driveMatch = normalized.match(/^([A-Za-z]:)(?:\/|$)/);
    const root = uncRoot ?? (driveMatch ? `${driveMatch[1]}/` : normalized.startsWith('/') ? '/' : '');
    if (!root) return path;

    const parts: string[] = [];
    for (const part of normalized.slice(root.length).replace(/^\/+/, '').split('/')) {
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
  };

  const getParentPath = (path: string): string | null => {
    const normalized = normalize(path).replace(/\/+$/, '');
    if (!normalized || normalized === '/') {
      return null;
    }

    const uncRoot = getUncRoot(normalized);
    if (uncRoot && normalized === uncRoot) {
      return null;
    }

    const lastSlashIndex = normalized.lastIndexOf('/');
    if (lastSlashIndex === -1) {
      return null;
    }

    let parent = normalized.slice(0, lastSlashIndex);
    if (!parent) {
      parent = '/';
    } else if (/^[A-Za-z]:$/.test(parent)) {
      parent = `${parent}/`;
    }

    if (path.includes('\\')) {
      return parent.replace(/\//g, '\\');
    }

    return parent;
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
    isAbsolutePath: (path: string) => path.startsWith('/') || /^[A-Za-z]:[\\/]/.test(path) || /^\\\\[^\\]+\\[^\\]+/.test(path),
    normalizeAbsolutePath,
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
    expect(getSingleOpenSelection('/notesRoot/docs/a.md')).toBe('/notesRoot/docs/a.md');
    expect(getSingleOpenSelection(['/notesRoot/docs/a.md', '/notesRoot/docs/b.md'])).toBe('/notesRoot/docs/a.md');
  });

  it('accepts supported Markdown extensions', () => {
    expect(isSupportedMarkdownSelection('/notesRoot/docs/README.MD')).toBe(true);
    expect(isSupportedMarkdownSelection('/notesRoot/docs/note.markdown')).toBe(true);
    expect(isSupportedMarkdownSelection('/notesRoot/docs/note.mdown')).toBe(true);
    expect(isSupportedMarkdownSelection('/notesRoot/docs/note.mkd')).toBe(true);
    expect(isSupportedMarkdownSelection('/notesRoot/.notes/alpha.md')).toBe(true);
    expect(isSupportedMarkdownSelection('C:\\notesRoot\\docs\\alpha.md')).toBe(true);
    expect(isSupportedMarkdownSelection('/notesRoot/docs/data.txt')).toBe(false);
    expect(isSupportedMarkdownSelection('/notesRoot/.vlaina/workspace.md')).toBe(false);
    expect(isSupportedMarkdownSelection('/notesRoot/docs/.git/config.md')).toBe(false);
    expect(isSupportedMarkdownSelection('/notesRoot/.VLAINA/workspace.md')).toBe(false);
    expect(isSupportedMarkdownSelection('/notesRoot/docs/.GIT/config.md')).toBe(false);
    expect(isSupportedMarkdownSelection('/notesRoot/docs/../.git/config.md')).toBe(false);
    expect(isSupportedMarkdownSelection('/notesRoot/.notes/../.vlaina/workspace.md')).toBe(false);
  });

  it('rejects explicit URL schemes before treating selections as files', () => {
    expect(isSupportedMarkdownSelection('https://example.com/docs/readme.md')).toBe(false);
    expect(isSupportedMarkdownSelection('http://127.0.0.1/private.md')).toBe(false);
    expect(isSupportedMarkdownSelection('file:///notesRoot/docs/readme.md')).toBe(false);
    expect(isSupportedMarkdownSelection('asset://localhost/readme.md')).toBe(false);
    expect(isSupportedMarkdownSelection(String.raw`https\://example.com/docs/readme.md`)).toBe(false);
    expect(isSupportedMarkdownSelection(String.raw`file\:///notesRoot/docs/readme.md`)).toBe(false);
  });

  it('rejects markdown selections with unsafe path characters', () => {
    expect(isSupportedMarkdownSelection('/notesRoot/docs/secret\0.md')).toBe(false);
    expect(isSupportedMarkdownSelection('/notesRoot/docs/secret\u001F.md')).toBe(false);
    expect(isSupportedMarkdownSelection('/notesRoot/docs/secret\u202Egnp.md')).toBe(false);
    expect(isSupportedMarkdownSelection('/notesRoot/docs/secret\uFFFD.md')).toBe(false);
    expect(isSupportedMarkdownSelection('/notesRoot/docs\u202E/alpha.md')).toBe(false);
    expect(isSupportedMarkdownSelection('/notesRoot/.notes/alpha.md')).toBe(true);
  });

  it('uses the selected file parent folder as the opened notesRoot', () => {
    expect(resolveOpenNoteTarget('/notesRoot/projects/docs/a.md')).toEqual({
      notesRootPath: '/notesRoot/projects/docs',
      notePath: 'a.md',
    });
  });

  it('rejects non-Markdown open targets even when called directly', () => {
    expect(() => resolveOpenNoteTarget('/notesRoot/docs/image.png')).toThrow(
      'Selected file path must be a supported Markdown file',
    );
  });

  it('resolves user dot folder markdown open targets', () => {
    expect(resolveOpenNoteTarget('/notesRoot/.notes/daily.md')).toEqual({
      notesRootPath: '/notesRoot/.notes',
      notePath: 'daily.md',
    });
  });

  it('falls back to the parent folder when opening a file at the notesRoot root', () => {
    expect(resolveOpenNoteTarget('/notesRoot/docs/a.md')).toEqual({
      notesRootPath: '/notesRoot/docs',
      notePath: 'a.md',
    });
  });

  it('resolves Windows paths using the selected file parent folder', () => {
    expect(resolveOpenNoteTarget('C:\\notesRoot\\docs\\a.md')).toEqual({
      notesRootPath: 'C:\\notesRoot\\docs',
      notePath: 'a.md',
    });
  });

  it('normalizes dot segments before resolving the selected file parent folder', () => {
    expect(resolveOpenNoteTarget('/notesRoot/docs/../alpha.md')).toEqual({
      notesRootPath: '/notesRoot',
      notePath: 'alpha.md',
    });
    expect(resolveOpenNoteTarget('C:\\notesRoot\\docs\\..\\alpha.md')).toEqual({
      notesRootPath: 'C:\\notesRoot',
      notePath: 'alpha.md',
    });
  });

  it('resolves UNC paths after normalizing dot segments', () => {
    expect(resolveOpenNoteTarget('\\\\server\\share\\docs\\..\\alpha.md')).toEqual({
      notesRootPath: '\\\\server\\share',
      notePath: 'alpha.md',
    });
  });

  it('rejects markdown files inside hidden app and git folders', () => {
    expect(() => resolveOpenNoteTarget('/notesRoot/.vlaina/workspace.md')).toThrow(
      'Selected file path must not be inside an internal notes folder',
    );
    expect(() => resolveOpenNoteTarget('/notesRoot/docs/.git/config.md')).toThrow(
      'Selected file path must not be inside an internal notes folder',
    );
    expect(() => resolveOpenNoteTarget('/notesRoot/.VLAINA/workspace.md')).toThrow(
      'Selected file path must not be inside an internal notes folder',
    );
    expect(() => resolveOpenNoteTarget('/notesRoot/docs/.GIT/config.md')).toThrow(
      'Selected file path must not be inside an internal notes folder',
    );
  });

  it('rejects markdown open targets with unsafe path characters', () => {
    expect(() => resolveOpenNoteTarget('/notesRoot/docs/secret\0.md')).toThrow(
      'Selected file path contains unsupported characters',
    );
    expect(() => resolveOpenNoteTarget('/notesRoot/docs/secret\u202Egnp.md')).toThrow(
      'Selected file path contains unsupported characters',
    );
    expect(() => resolveOpenNoteTarget('/notesRoot/docs/secret\uFFFD.md')).toThrow(
      'Selected file path contains unsupported characters',
    );
  });

  it('rejects relative markdown paths when resolving open targets', () => {
    expect(() => resolveOpenNoteTarget('docs/alpha.md')).toThrow(
      'Selected file path must be absolute',
    );
  });
});
