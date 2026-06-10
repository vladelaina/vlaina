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
  isAbsolutePath: (path: string) => path.startsWith('/') || /^[A-Za-z]:[\\/]/.test(path),
  joinPath: (...segments: string[]) => Promise.resolve(segments.join('/').replace(/\/+/g, '/')),
  normalizeAbsolutePath: (path: string) => {
    const normalized = path.replace(/\\/g, '/');
    const root = normalized.startsWith('/') ? '/' : /^[A-Za-z]:\//.test(normalized) ? normalized.slice(0, 3) : '';
    if (!root) return path;
    const parts: string[] = [];
    for (const part of normalized.slice(root.length).split('/')) {
      if (!part || part === '.') continue;
      if (part === '..') {
        parts.pop();
        continue;
      }
      parts.push(part);
    }
    const nextPath = `${root}${parts.join('/')}`;
    return path.includes('\\') ? nextPath.replace(/\//g, '\\') : nextPath;
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
    await expect(loadNoteDocument({
      notesPath: '/vault',
      path: '.VLAINA/workspace.md',
      cache: new Map(),
    })).rejects.toThrow('Path must not be inside an internal notes folder.');
    await expect(loadNoteDocument({
      notesPath: '/vault',
      path: 'docs/.GIT/config.md',
      cache: new Map(),
    })).rejects.toThrow('Path must not be inside an internal notes folder.');

    expect(adapter.stat).not.toHaveBeenCalled();
    expect(adapter.readFile).not.toHaveBeenCalled();
  });

  it('does not load non-markdown note documents', async () => {
    await expect(loadNoteDocument({
      notesPath: '/vault',
      path: 'docs/secret.txt',
      cache: new Map(),
    })).rejects.toThrow('Only Markdown files can be opened as notes.');

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
    await expect(loadNoteDocument({
      notesPath: '/vault',
      path: '.VLAINA/workspace.md',
      cache: new Map([
        ['.VLAINA/workspace.md', { content: '# Cached', modifiedAt: 1 }],
      ]),
      allowStaleCachedContent: true,
    })).rejects.toThrow('Path must not be inside an internal notes folder.');

    expect(adapter.stat).not.toHaveBeenCalled();
    expect(adapter.readFile).not.toHaveBeenCalled();
  });

  it('does not load markdown documents with unsafe path characters', async () => {
    await expect(loadNoteDocument({
      notesPath: '/vault',
      path: 'docs/secret\u202Egnp.md',
      cache: new Map(),
    })).rejects.toThrow('Selected file path contains unsupported characters');
    await expect(loadNoteDocument({
      notesPath: '/vault',
      path: 'docs/secret\u001F.md',
      cache: new Map([
        ['docs/secret\u001F.md', { content: '# Cached', modifiedAt: 1 }],
      ]),
      allowStaleCachedContent: true,
    })).rejects.toThrow('Selected file path contains unsupported characters');

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
    await expect(saveNoteDocument({
      notesPath: '/vault',
      currentNote: {
        path: '.VLAINA/workspace.md',
        content: '# Config',
      },
      cache: new Map(),
    })).rejects.toThrow('Path must not be inside an internal notes folder.');
    await expect(saveNoteDocument({
      notesPath: '/vault',
      currentNote: {
        path: 'docs/.GIT/config.md',
        content: '# Config',
      },
      cache: new Map(),
    })).rejects.toThrow('Path must not be inside an internal notes folder.');

    expect(adapter.stat).not.toHaveBeenCalled();
    expect(adapter.readFile).not.toHaveBeenCalled();
    expect(adapter.writeFile).not.toHaveBeenCalled();
  });

  it('does not save markdown documents with unsafe path characters', async () => {
    await expect(saveNoteDocument({
      notesPath: '/vault',
      currentNote: {
        path: 'docs/secret\u202Egnp.md',
        content: '# Secret',
      },
      cache: new Map(),
    })).rejects.toThrow('Selected file path contains unsupported characters');

    expect(adapter.stat).not.toHaveBeenCalled();
    expect(adapter.readFile).not.toHaveBeenCalled();
    expect(adapter.writeFile).not.toHaveBeenCalled();
  });

  it('does not save non-markdown note documents', async () => {
    await expect(saveNoteDocument({
      notesPath: '/vault',
      currentNote: {
        path: 'docs/secret.txt',
        content: '# Secret',
      },
      cache: new Map(),
    })).rejects.toThrow('Only Markdown files can be opened as notes.');

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

  it('allows Windows absolute note documents without treating the drive prefix as unsafe', async () => {
    await expect(loadNoteDocument({
      notesPath: '/vault',
      path: 'C:\\vault\\docs\\alpha.md',
      cache: new Map(),
    })).resolves.toMatchObject({ content: '# Alpha' });

    await expect(saveNoteDocument({
      notesPath: '/vault',
      currentNote: {
        path: 'C:\\vault\\docs\\alpha.md',
        content: '# Alpha',
      },
      cache: new Map(),
      updatedAt: Date.parse('2026-04-15T10:00:00.000Z'),
    })).resolves.toMatchObject({
      content: expect.stringContaining('# Alpha'),
    });

    expect(adapter.readFile).toHaveBeenCalledWith('C:\\vault\\docs\\alpha.md');
    expect(adapter.writeFile).toHaveBeenCalledWith(
      'C:\\vault\\docs\\alpha.md',
      expect.stringContaining('# Alpha')
    );
  });

  it('loads every supported markdown extension', async () => {
    for (const path of ['alpha.md', 'beta.markdown', 'gamma.mdown', 'delta.mkd']) {
      await expect(loadNoteDocument({
        notesPath: '/vault',
        path,
        cache: new Map(),
      })).resolves.toMatchObject({ content: '# Alpha' });
    }

    expect(adapter.readFile).toHaveBeenCalledWith('/vault/alpha.md');
    expect(adapter.readFile).toHaveBeenCalledWith('/vault/beta.markdown');
    expect(adapter.readFile).toHaveBeenCalledWith('/vault/gamma.mdown');
    expect(adapter.readFile).toHaveBeenCalledWith('/vault/delta.mkd');
  });

  it('saves every supported markdown extension', async () => {
    for (const path of ['alpha.md', 'beta.markdown', 'gamma.mdown', 'delta.mkd']) {
      await expect(saveNoteDocument({
        notesPath: '/vault',
        currentNote: {
          path,
          content: '# Alpha',
        },
        cache: new Map(),
        updatedAt: Date.parse('2026-04-15T10:00:00.000Z'),
      })).resolves.toMatchObject({
        content: expect.stringContaining('# Alpha'),
      });
    }

    expect(adapter.writeFile).toHaveBeenCalledWith('/vault/alpha.md', expect.any(String));
    expect(adapter.writeFile).toHaveBeenCalledWith('/vault/beta.markdown', expect.any(String));
    expect(adapter.writeFile).toHaveBeenCalledWith('/vault/gamma.mdown', expect.any(String));
    expect(adapter.writeFile).toHaveBeenCalledWith('/vault/delta.mkd', expect.any(String));
  });
});
