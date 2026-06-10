import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setCachedNoteContent } from './noteContentCache';
import { loadNoteDocument, NoteWriteConflictError, saveNoteDocument } from './noteDocumentPersistence';

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
  normalizeAbsolutePath: (path: string) => path,
}));

vi.mock('./externalChangeRegistry', () => ({
  markExpectedExternalChange: vi.fn(),
}));

describe('note document stat fallback validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reloads clean cached markdown when stat has size but no modified timestamp', async () => {
    adapter.stat.mockResolvedValue({ isFile: true, size: 8 });
    adapter.readFile.mockResolvedValue('# Disked');

    const result = await loadNoteDocument({
      notesPath: '/vault',
      path: 'alpha.md',
      cache: setCachedNoteContent(new Map(), 'alpha.md', '# Cached', null, {
        updateBaseline: true,
        size: 8,
      }),
    });

    expect(adapter.readFile).toHaveBeenCalledWith('/vault/alpha.md');
    expect(result.content).toBe('# Disked');
    expect(result.modifiedAt).toBeNull();
    expect(result.size).toBe(8);
  });

  it('checks disk content before saving when stat has size but no modified timestamp', async () => {
    adapter.stat.mockResolvedValue({ isFile: true, size: 8 });
    adapter.readFile.mockResolvedValue('# Disked');

    await expect(saveNoteDocument({
      notesPath: '/vault',
      currentNote: {
        path: 'alpha.md',
        content: '# Local',
      },
      cache: setCachedNoteContent(new Map(), 'alpha.md', '# Cached', null, {
        updateBaseline: true,
        size: 8,
      }),
    })).rejects.toBeInstanceOf(NoteWriteConflictError);

    expect(adapter.readFile).toHaveBeenCalledWith('/vault/alpha.md');
    expect(adapter.writeFile).not.toHaveBeenCalled();
  });
});
