import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setCachedNoteContent } from './noteContentCache';
import { loadNoteDocument } from './noteDocumentPersistence';

const MAX_NOTE_DOCUMENT_BYTES = 10 * 1024 * 1024;

const adapter = {
  readFile: vi.fn<(path: string, maxBytes?: number) => Promise<string>>(),
  stat: vi.fn<
    (path: string) => Promise<{ isFile?: boolean; isDirectory?: boolean; modifiedAt?: number | null; size?: number | null } | null>
  >(),
};

vi.mock('@/lib/storage/adapter', () => ({
  getStorageAdapter: () => adapter,
  isAbsolutePath: (path: string) => path.startsWith('/'),
  joinPath: (...segments: string[]) => Promise.resolve(segments.join('/').replace(/\/+/g, '/')),
  normalizeAbsolutePath: (path: string) => path,
}));

describe('loadNoteDocument cache validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not return clean cached markdown after the disk file disappears', async () => {
    adapter.stat.mockResolvedValue(null);

    await expect(loadNoteDocument({
      notesPath: '/notesRoot',
      path: 'alpha.md',
      cache: setCachedNoteContent(new Map(), 'alpha.md', '# Cached', 100, {
        updateBaseline: true,
        size: 8,
      }),
    })).rejects.toThrow('Note file is too large to open.');

    expect(adapter.readFile).not.toHaveBeenCalled();
  });

  it('reloads clean cached markdown when disk mtime moves backwards', async () => {
    adapter.stat.mockResolvedValue({ isFile: true, modifiedAt: 100, size: 8 });
    adapter.readFile.mockResolvedValue('# Disked');

    const result = await loadNoteDocument({
      notesPath: '/notesRoot',
      path: 'alpha.md',
      cache: setCachedNoteContent(new Map(), 'alpha.md', '# Cached', 200, {
        updateBaseline: true,
        size: 8,
      }),
    });

    expect(adapter.readFile).toHaveBeenCalledWith('/notesRoot/alpha.md', MAX_NOTE_DOCUMENT_BYTES);
    expect(result.content).toBe('# Disked');
    expect(result.modifiedAt).toBe(100);
    expect(result.nextCache.get('alpha.md')?.content).toBe('# Disked');
  });

  it('keeps dirty cached markdown when stale content is explicitly allowed', async () => {
    const result = await loadNoteDocument({
      notesPath: '/notesRoot',
      path: 'alpha.md',
      cache: setCachedNoteContent(new Map(), 'alpha.md', '# Unsaved', 100, {
        updateBaseline: true,
        size: 8,
      }),
      allowStaleCachedContent: true,
    });

    expect(adapter.stat).not.toHaveBeenCalled();
    expect(adapter.readFile).not.toHaveBeenCalled();
    expect(result.content).toBe('# Unsaved');
  });

  it('uses normalized relative note paths for cache lookup', async () => {
    const result = await loadNoteDocument({
      notesPath: '/notesRoot',
      path: './docs//alpha.md',
      cache: setCachedNoteContent(new Map(), 'docs/alpha.md', '# Cached', 100, {
        updateBaseline: true,
        size: 8,
      }),
      allowStaleCachedContent: true,
    });

    expect(adapter.stat).not.toHaveBeenCalled();
    expect(adapter.readFile).not.toHaveBeenCalled();
    expect(result.content).toBe('# Cached');
    expect(result.nextCache.has('docs/alpha.md')).toBe(true);
    expect(result.nextCache.has('./docs//alpha.md')).toBe(false);
  });
});
