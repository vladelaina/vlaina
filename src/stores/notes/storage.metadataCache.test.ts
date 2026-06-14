import { beforeEach, describe, expect, it, vi } from 'vitest';

const adapter = {
  stat: vi.fn<(path: string) => Promise<{ modifiedAt?: number | null; size?: number | null } | null>>(),
  readFile: vi.fn<(path: string, maxBytes?: number) => Promise<string>>(),
  listDir: vi.fn<(path: string, options?: { includeHidden?: boolean }) => Promise<Array<{
    name: string;
    isDirectory?: boolean;
    isFile?: boolean;
  }>>>(),
};

vi.mock('@/lib/storage/adapter', () => ({
  getStorageAdapter: () => adapter,
  joinPath: (...segments: string[]) => Promise.resolve(segments.join('/')),
}));

import { loadNoteMetadata } from './storage';

describe('notes metadata cache validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    adapter.listDir.mockResolvedValue([{ name: 'alpha.md', isFile: true }]);
    adapter.stat.mockResolvedValue({ size: 80 });
  });

  it('does not reuse cached metadata when stat has size but no modified time', async () => {
    adapter.readFile
      .mockResolvedValueOnce([
        '---',
        'vlaina_icon: "💡"',
        '---',
        '',
        '# Alpha',
      ].join('\n'))
      .mockResolvedValueOnce([
        '---',
        'vlaina_icon: "📘"',
        '---',
        '',
        '# Alpha',
      ].join('\n'));

    await expect(loadNoteMetadata('/vault-no-mtime-cache')).resolves.toEqual({
      version: 2,
      notes: {
        'alpha.md': { icon: '💡' },
      },
    });
    await expect(loadNoteMetadata('/vault-no-mtime-cache')).resolves.toEqual({
      version: 2,
      notes: {
        'alpha.md': { icon: '📘' },
      },
    });
    expect(adapter.readFile).toHaveBeenCalledTimes(2);
  });
});
