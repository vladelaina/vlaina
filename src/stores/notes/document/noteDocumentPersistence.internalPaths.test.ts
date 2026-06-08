import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadNoteDocument, saveNoteDocument } from './noteDocumentPersistence';

const adapter = {
  readFile: vi.fn<(path: string) => Promise<string>>(),
  writeFile: vi.fn<(path: string, content: string) => Promise<void>>(),
  stat: vi.fn<
    (path: string) => Promise<{ isFile?: boolean; isDirectory?: boolean; modifiedAt?: number | null; size?: number | null } | null>
  >(),
};

vi.mock('@/lib/storage/adapter', () => ({
  getStorageAdapter: () => adapter,
  isAbsolutePath: (path: string) => path.startsWith('/'),
  joinPath: (...segments: string[]) => Promise.resolve(segments.join('/').replace(/\/+/g, '/')),
  normalizeAbsolutePath: (path: string) => {
    if (!path.startsWith('/')) return path;
    const parts: string[] = [];
    for (const part of path.split('/')) {
      if (!part || part === '.') continue;
      if (part === '..') {
        parts.pop();
        continue;
      }
      parts.push(part);
    }
    return `/${parts.join('/')}`;
  },
}));

vi.mock('./externalChangeRegistry', () => ({
  markExpectedExternalChange: vi.fn(),
}));

describe('note document internal paths', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    adapter.stat.mockResolvedValue({ isFile: true, modifiedAt: 1, size: 16 });
    adapter.readFile.mockResolvedValue('# Alpha');
    adapter.writeFile.mockResolvedValue();
  });

  it('does not load hidden app or git note documents', async () => {
    await expect(loadNoteDocument({
      notesPath: '/vault',
      path: '.vlaina/workspace.md',
      cache: new Map(),
    })).rejects.toThrow('Path must not be inside an internal notes folder.');
    await expect(loadNoteDocument({
      notesPath: '/vault',
      path: 'docs/.git/config.md',
      cache: new Map(),
    })).rejects.toThrow('Path must not be inside an internal notes folder.');

    expect(adapter.stat).not.toHaveBeenCalled();
    expect(adapter.readFile).not.toHaveBeenCalled();
  });

  it('does not return cached markdown for hidden app or git note documents', async () => {
    await expect(loadNoteDocument({
      notesPath: '/vault',
      path: '.vlaina/workspace.md',
      cache: new Map([
        ['.vlaina/workspace.md', { content: '# Cached', modifiedAt: 1 }],
      ]),
      allowStaleCachedContent: true,
    })).rejects.toThrow('Path must not be inside an internal notes folder.');

    expect(adapter.stat).not.toHaveBeenCalled();
    expect(adapter.readFile).not.toHaveBeenCalled();
  });

  it('does not save hidden app or git note documents', async () => {
    await expect(saveNoteDocument({
      notesPath: '/vault',
      currentNote: {
        path: 'docs/.git/config.md',
        content: '# Config',
      },
      cache: new Map(),
    })).rejects.toThrow('Path must not be inside an internal notes folder.');

    expect(adapter.stat).not.toHaveBeenCalled();
    expect(adapter.readFile).not.toHaveBeenCalled();
    expect(adapter.writeFile).not.toHaveBeenCalled();
  });

  it('allows user dot-folder note documents', async () => {
    const result = await loadNoteDocument({
      notesPath: '/vault',
      path: '.notes/alpha.md',
      cache: new Map(),
    });

    expect(adapter.readFile).toHaveBeenCalledWith('/vault/.notes/alpha.md');
    expect(result.content).toBe('# Alpha');
  });
});
