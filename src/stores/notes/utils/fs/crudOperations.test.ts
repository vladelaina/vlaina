import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createNoteImpl } from './crudOperations';

const adapter = {
  writeFile: vi.fn<(path: string, content: string) => Promise<void>>(),
  exists: vi.fn<(path: string) => Promise<boolean>>(),
  stat: vi.fn<
    (path: string) => Promise<{ isFile?: boolean; isDirectory?: boolean; createdAt?: number | null; modifiedAt?: number | null; size?: number | null } | null>
  >(),
  mkdir: vi.fn<(path: string, recursive?: boolean) => Promise<void>>(),
  readFile: vi.fn<(path: string) => Promise<string>>(),
};

const hoisted = vi.hoisted(() => ({
  resolveUniquePath: vi.fn(),
  markExpectedExternalChange: vi.fn(),
}));

vi.mock('./pathOperations', () => ({
  getParentPath: (path: string) => path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '',
  resolveUniquePath: hoisted.resolveUniquePath,
}));

vi.mock('../../document/externalChangeRegistry', () => ({
  markExpectedExternalChange: hoisted.markExpectedExternalChange,
}));

vi.mock('@/lib/storage/adapter', () => ({
  getStorageAdapter: () => adapter,
  isAbsolutePath: (path: string) => path.startsWith('/') || /^[A-Za-z]:[\\/]/.test(path),
  joinPath: (...segments: string[]) => Promise.resolve(segments.join('/')),
}));

describe('createNoteImpl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    adapter.writeFile.mockResolvedValue();
    adapter.stat.mockResolvedValue({ createdAt: 122, modifiedAt: 123, size: 16 });
  });

  it('preserves incoming managed frontmatter fields and derives timestamps from file stats', async () => {
    hoisted.resolveUniquePath.mockResolvedValue({
      relativePath: 'alpha.md',
      fullPath: '/vault/alpha.md',
      fileName: 'alpha.md',
    });

    const result = await createNoteImpl('/vault', undefined, 'alpha', [
      '---',
      'vlaina_cover: "assets/alpha.webp"',
      'vlaina_icon: "🐱" size=84',
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
      'vlaina_icon: "🐱" size=84',
      '---',
      '',
      '# Alpha',
    ].join('\n'));
    expect(result.updatedMetadata.notes['alpha.md']).toEqual({
      cover: {
        assetPath: 'assets/alpha.webp',
      },
      icon: '🐱',
      iconSize: 84,
      createdAt: 122,
      updatedAt: 123,
    });
    expect(result.modifiedAt).toBe(123);
    expect(result.size).toBe(16);
  });

  it('cleans internal editor break markers before creating a note', async () => {
    hoisted.resolveUniquePath.mockResolvedValue({
      relativePath: 'alpha.md',
      fullPath: '/vault/alpha.md',
      fileName: 'alpha.md',
    });

    const result = await createNoteImpl(
      '/vault',
      undefined,
      'alpha',
      ['# Alpha', '<br data-vlaina-empty-line="true"/>', 'Body'].join('\n'),
      {
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
      }
    );

    expect(adapter.writeFile).toHaveBeenCalledWith(
      '/vault/alpha.md',
      ['# Alpha', '', 'Body'].join('\n')
    );
    expect(result.content).not.toContain('data-vlaina-empty-line');
  });

  it('cleans serialized editor-only markdown artifacts before creating a note', async () => {
    hoisted.resolveUniquePath.mockResolvedValue({
      relativePath: 'alpha.md',
      fullPath: '/vault/alpha.md',
      fileName: 'alpha.md',
    });

    const result = await createNoteImpl(
      '/vault',
      undefined,
      'alpha',
      [
        '# Alpha',
        '<!--vlaina-markdown-blank-line-->',
        '&#x20; Pro:   \\$76.80 / year',
        '&#32 Max:   \\$191.90 / year',
      ].join('\n'),
      {
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
      }
    );

    const written = String(adapter.writeFile.mock.calls[0]?.[1] ?? '');
    expect(written).toBe([
      '# Alpha',
      '',
      '  Pro:   \\$76.80 / year',
      ' Max:   \\$191.90 / year',
    ].join('\n'));
    expect(written).not.toContain('vlaina-markdown-blank-line');
    expect(written).not.toContain('&#x20');
    expect(written).not.toContain('&#32');
    expect(result.content).toBe(written);
  });

  it('converts internal user break markers before creating a note', async () => {
    hoisted.resolveUniquePath.mockResolvedValue({
      relativePath: 'alpha.md',
      fullPath: '/vault/alpha.md',
      fileName: 'alpha.md',
    });

    const result = await createNoteImpl(
      '/vault',
      undefined,
      'alpha',
      ['Line one', '<br data-vlaina-user-br="true" />', 'Line two'].join('\n'),
      {
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
      }
    );

    expect(adapter.writeFile).toHaveBeenCalledWith(
      '/vault/alpha.md',
      [
        'Line one\\',
        'Line two',
      ].join('\n')
    );
    expect(result.content).not.toContain('data-vlaina-user-br');
  });

  it('does not expose invalid created note file stats', async () => {
    adapter.stat.mockResolvedValue({ modifiedAt: Number.POSITIVE_INFINITY, size: -1 });
    hoisted.resolveUniquePath.mockResolvedValue({
      relativePath: 'alpha.md',
      fullPath: '/vault/alpha.md',
      fileName: 'alpha.md',
    });

    const result = await createNoteImpl('/vault', undefined, 'alpha', '# Alpha', {
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

    expect(result.modifiedAt).toBeNull();
    expect(result.size).toBeNull();
  });

  it('adds created notes to the normalized result parent in returned tree children', async () => {
    hoisted.resolveUniquePath.mockResolvedValue({
      relativePath: 'archive/alpha.md',
      fullPath: '/vault/archive/alpha.md',
      fileName: 'alpha.md',
    });

    const result = await createNoteImpl('/vault', 'archive/.', 'alpha', '# Alpha', {
      rootFolder: {
        id: '',
        name: 'Notes',
        path: '',
        isFolder: true,
        children: [{
          id: 'archive',
          name: 'archive',
          path: 'archive',
          isFolder: true,
          children: [],
          expanded: false,
        }],
        expanded: true,
      },
      recentNotes: [],
      noteMetadata: null,
    });

    expect(adapter.mkdir).toHaveBeenCalledWith('/vault/archive', true);
    expect(result.newChildren).toEqual([
      expect.objectContaining({
        path: 'archive',
        children: [
          expect.objectContaining({
            path: 'archive/alpha.md',
            name: 'alpha',
          }),
        ],
        expanded: true,
      }),
    ]);
  });
});
