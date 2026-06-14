import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';

import {
  isSupportedMarkdownPath,
  maxOpenMarkdownFilePathChars,
  normalizeMarkdownOpenPath,
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
    const result = normalizeMarkdownOpenPath('file:///tmp/note.mkd', { fsImpl });

    expect(result).toBe(path.resolve('/tmp/note.mkd'));
    expect(fsImpl.statSync).toHaveBeenCalledWith(path.resolve('/tmp/note.mkd'));
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
});
