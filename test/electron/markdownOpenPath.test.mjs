import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it, vi } from 'vitest';

import {
  isSupportedMarkdownPath,
  maxOpenMarkdownFilePathChars,
  normalizeMarkdownOpenPath,
  findMarkdownGitRoot,
} from '../../electron/markdownOpenPath.mjs';

function createFsImpl(isFile = true) {
  return {
    statSync: vi.fn(() => ({
      isFile: () => isFile,
    })),
  };
}

describe('markdownOpenPath', () => {
  it('supports the shared Markdown extension set', () => {
    expect(isSupportedMarkdownPath('/tmp/note.md')).toBe(true);
    expect(isSupportedMarkdownPath('/tmp/note.markdown')).toBe(true);
    expect(isSupportedMarkdownPath('/tmp/note.mdown')).toBe(true);
    expect(isSupportedMarkdownPath('/tmp/note.mkd')).toBe(true);
    expect(isSupportedMarkdownPath('/tmp/note.txt')).toBe(false);
  });

  it('rejects oversized raw paths before statting the filesystem', () => {
    const fsImpl = createFsImpl();
    const result = normalizeMarkdownOpenPath(`${'x'.repeat(maxOpenMarkdownFilePathChars)}.md`, { fsImpl });

    expect(result).toBeNull();
    expect(fsImpl.statSync).not.toHaveBeenCalled();
  });

  it('rejects file URLs that decode to unsafe paths before statting the filesystem', () => {
    const fsImpl = createFsImpl();
    const result = normalizeMarkdownOpenPath('file:///tmp/unsafe%0A.md', { fsImpl });

    expect(result).toBeNull();
    expect(fsImpl.statSync).not.toHaveBeenCalled();
  });

  it('normalizes supported Markdown file URLs after confirming they are files', () => {
    const fsImpl = createFsImpl();
    const expectedPath = path.resolve('/tmp/note.mkd');
    const result = normalizeMarkdownOpenPath(pathToFileURL(expectedPath).href, { fsImpl });

    expect(result).toBe(expectedPath);
    expect(fsImpl.statSync).toHaveBeenCalledWith(expectedPath);
  });

  it('rejects overlong resolved paths before statting the filesystem', () => {
    const fsImpl = createFsImpl();
    const pathImpl = {
      ...path,
      resolve: vi.fn(() => `/tmp/${'x'.repeat(maxOpenMarkdownFilePathChars)}.md`),
    };
    const result = normalizeMarkdownOpenPath('note.md', { fsImpl, pathImpl });

    expect(result).toBeNull();
    expect(fsImpl.statSync).not.toHaveBeenCalled();
  });

  it('uses the nearest ancestor with a .git directory as the open root', () => {
    const fsImpl = {
      statSync: vi.fn((candidatePath) => {
        if (candidatePath === '/projects/app/.git') {
          return { isDirectory: () => true, isFile: () => false };
        }
        if (candidatePath === '/projects/app/.git/HEAD') {
          return { isFile: () => true };
        }
        throw new Error('not found');
      }),
    };

    expect(findMarkdownGitRoot('/projects/app/docs/guide/setup.md', { fsImpl })).toBe('/projects/app');
  });

  it('recognizes worktree .git files as repository markers', () => {
    const fsImpl = {
      statSync: vi.fn((candidatePath) => {
        if (candidatePath === '/projects/worktree/.git') {
          return { isDirectory: () => false, isFile: () => true, size: 48 };
        }
        if (candidatePath === '/git/worktrees/project') {
          return { isDirectory: () => true };
        }
        if (candidatePath === '/git/worktrees/project/HEAD') {
          return { isFile: () => true };
        }
        throw new Error('not found');
      }),
      readFileSync: vi.fn(() => 'gitdir: /git/worktrees/project\n'),
    };

    expect(findMarkdownGitRoot('/projects/worktree/docs/setup.md', { fsImpl })).toBe('/projects/worktree');
  });

  it('returns null when no Git repository is found', () => {
    const fsImpl = {
      statSync: vi.fn(() => {
        throw new Error('not found');
      }),
    };

    expect(findMarkdownGitRoot('/notes/docs/setup.md', { fsImpl })).toBeNull();
  });

  it('ignores .git directories that do not contain repository metadata', () => {
    const fsImpl = {
      statSync: vi.fn((candidatePath) => {
        if (candidatePath === '/tmp/.git') {
          return { isDirectory: () => true, isFile: () => false };
        }
        throw new Error('not found');
      }),
    };

    expect(findMarkdownGitRoot('/tmp/project/docs/setup.md', { fsImpl })).toBeNull();
  });
});
