import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createNoteImpl } from './crudOperations';

const adapter = {
  writeFile: vi.fn<(path: string, content: string) => Promise<void>>(),
  exists: vi.fn<(path: string) => Promise<boolean>>(),
  stat: vi.fn<
    (path: string) => Promise<{ isFile?: boolean; isDirectory?: boolean; modifiedAt?: number | null } | null>
  >(),
  mkdir: vi.fn<(path: string, recursive?: boolean) => Promise<void>>(),
  readFile: vi.fn<(path: string) => Promise<string>>(),
};

const hoisted = vi.hoisted(() => ({
  resolveUniquePath: vi.fn(),
  markExpectedExternalChange: vi.fn(),
}));

vi.mock('./pathOperations', () => ({
  resolveUniquePath: hoisted.resolveUniquePath,
}));

vi.mock('../../document/externalChangeRegistry', () => ({
  markExpectedExternalChange: hoisted.markExpectedExternalChange,
}));

vi.mock('@/lib/storage/adapter', () => ({
  getStorageAdapter: () => adapter,
  joinPath: (...segments: string[]) => Promise.resolve(segments.join('/')),
}));

describe('createNoteImpl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    adapter.writeFile.mockResolvedValue();
    adapter.stat.mockResolvedValue({ modifiedAt: 123 });
  });

  it('preserves incoming managed frontmatter fields while filling missing timestamps', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-15T10:00:00.000Z'));
    hoisted.resolveUniquePath.mockResolvedValue({
      relativePath: 'alpha.md',
      fullPath: '/vault/alpha.md',
      fileName: 'alpha.md',
    });

    const result = await createNoteImpl('/vault', undefined, 'alpha', [
      '---',
      'vlaina_cover: "assets/alpha.webp"',
      'vlaina_icon: "🐱"',
      '---',
      '',
      '# Alpha',
    ].join('\n'), {
      rootFolder: {
        id: '',
        name: 'Notes',
        path: '',
        isFolder: true,
        children: [],
        expanded: true,
      },
      recentNotes: [],
      noteMetadata: null,
    });

    expect(adapter.writeFile).toHaveBeenNthCalledWith(1, '/vault/alpha.md', [
      '---',
      'vlaina_cover: "assets/alpha.webp"',
      'vlaina_icon: "🐱"',
      'vlaina_created: "2026-04-15T10:00:00.000Z"',
      'vlaina_updated: "2026-04-15T10:00:00.000Z"',
      '---',
      '',
      '# Alpha',
    ].join('\n'));
    expect(result.updatedMetadata.notes['alpha.md']).toEqual({
      cover: {
        assetPath: 'assets/alpha.webp',
      },
      icon: '🐱',
      createdAt: Date.parse('2026-04-15T10:00:00.000Z'),
      updatedAt: Date.parse('2026-04-15T10:00:00.000Z'),
    });
    expect(result.modifiedAt).toBe(123);

    vi.useRealTimers();
  });
});
