import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildFileTree, findNode } from './fileTreeUtils';
import { loadNoteMetadata } from './storage';
import { MAX_NOTES_ROOT_RELATIVE_PATH_CHARS } from './utils/fs/notesRootPathContainment';

const adapter = {
  exists: vi.fn<(path: string) => Promise<boolean>>(),
  listDir: vi.fn<(path: string) => Promise<Array<{
    name: string;
    path?: string;
    isDirectory?: boolean;
    isFile?: boolean;
  }>>>(),
  readFile: vi.fn<(path: string, maxBytes?: number) => Promise<string>>(),
  stat: vi.fn<(path: string) => Promise<{ modifiedAt?: number; size?: number } | null>>(),
};

vi.mock('@/lib/storage/adapter', () => ({
  getStorageAdapter: () => adapter,
  isAbsolutePath: (path: string) => path.startsWith('/') || /^[A-Za-z]:[\\/]/.test(path),
  joinPath: (...segments: string[]) => Promise.resolve(segments.filter(Boolean).join('/')),
}));

describe('notes scan budgets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    adapter.exists.mockResolvedValue(false);
    adapter.stat.mockResolvedValue({ modifiedAt: 1, size: 128 });
  });

  it('keeps markdown notes ahead of image files in the file tree budget', async () => {
    adapter.listDir.mockResolvedValue([
      ...Array.from({ length: 6000 }, (_, index) => ({
        name: `image-${index}.png`,
        path: `/notesRoot/image-${index}.png`,
        isDirectory: false,
        isFile: true,
      })),
      {
        name: 'alpha.md',
        path: '/notesRoot/alpha.md',
        isDirectory: false,
        isFile: true,
      },
    ]);

    const tree = await buildFileTree('/notesRoot');

    expect(tree).toHaveLength(5000);
    expect(findNode(tree, 'alpha.md')).toEqual({
      id: 'alpha.md',
      name: 'alpha',
      path: 'alpha.md',
      isFolder: false,
    });
    expect(findNode(tree, 'image-0.png')).toEqual({
      id: 'image-0.png',
      name: 'image-0.png',
      path: 'image-0.png',
      isFolder: false,
      kind: 'image',
    });
  });

  it('prioritizes late markdown before capping image file tree scanning', async () => {
    adapter.listDir.mockResolvedValue([
      ...Array.from({ length: 10_000 }, (_, index) => ({
        name: `image-${index}.png`,
        path: `/notesRoot/image-${index}.png`,
        isDirectory: false,
        isFile: true,
      })),
      {
        name: 'late.md',
        path: '/notesRoot/late.md',
        isDirectory: false,
        isFile: true,
      },
    ]);

    const tree = await buildFileTree('/notesRoot');

    expect(tree).toHaveLength(5000);
    expect(findNode(tree, 'late.md')).toEqual({
      id: 'late.md',
      name: 'late',
      path: 'late.md',
      isFolder: false,
    });
  });

  it('does not spend file tree entry budget on sibling folders before markdown notes', async () => {
    adapter.listDir.mockResolvedValue([
      ...Array.from({ length: 5000 }, (_, index) => ({
        name: `folder-${String(index).padStart(4, '0')}`,
        path: `/notes-root-folders/folder-${String(index).padStart(4, '0')}`,
        isDirectory: true,
        isFile: false,
      })),
      {
        name: 'late.md',
        path: '/notes-root-folders/late.md',
        isDirectory: false,
        isFile: true,
      },
    ]);

    const tree = await buildFileTree('/notes-root-folders');

    expect(findNode(tree, 'late.md')).toEqual({
      id: 'late.md',
      name: 'late',
      path: 'late.md',
      isFolder: false,
    });
  });

  it('does not spend file tree directory scan budget on unsafe entries before markdown notes', async () => {
    adapter.listDir.mockResolvedValue([
      ...Array.from({ length: 10_000 }, (_, index) => ({
        name: `../unsafe-${String(index).padStart(4, '0')}`,
        path: `/notes-root-unsafe/../unsafe-${String(index).padStart(4, '0')}`,
        isDirectory: true,
        isFile: false,
      })),
      {
        name: 'late.md',
        path: '/notes-root-unsafe/late.md',
        isDirectory: false,
        isFile: true,
      },
    ]);

    const tree = await buildFileTree('/notes-root-unsafe');

    expect(findNode(tree, 'late.md')).toEqual({
      id: 'late.md',
      name: 'late',
      path: 'late.md',
      isFolder: false,
    });
  });

  it('does not include markdown files whose nested relative path exceeds the opened folder path limit', async () => {
    const longFolder = 'd'.repeat(MAX_NOTES_ROOT_RELATIVE_PATH_CHARS - 2);
    const overlongPath = `${longFolder}/a.md`;

    adapter.listDir.mockImplementation(async (path: string) => {
      if (path === '/notes-root-overlong-tree') {
        return [
          {
            name: longFolder,
            path: `/notes-root-overlong-tree/${longFolder}`,
            isDirectory: true,
            isFile: false,
          },
          {
            name: 'safe.md',
            path: '/notes-root-overlong-tree/safe.md',
            isDirectory: false,
            isFile: true,
          },
        ];
      }

      if (path === `/notes-root-overlong-tree/${longFolder}`) {
        return [
          {
            name: 'a.md',
            path: `/notes-root-overlong-tree/${overlongPath}`,
            isDirectory: false,
            isFile: true,
          },
        ];
      }

      return [];
    });

    const tree = await buildFileTree('/notes-root-overlong-tree');

    expect(findNode(tree, 'safe.md')).toEqual({
      id: 'safe.md',
      name: 'safe',
      path: 'safe.md',
      isFolder: false,
    });
    expect(findNode(tree, overlongPath)).toBeNull();
  });

  it('prioritizes regular folders before low-priority generated folders during recursive scans', async () => {
    adapter.listDir.mockImplementation(async (path: string) => {
      if (path === '/notes-root-recursive') {
        return [
          {
            name: 'Dist',
            path: '/notes-root-recursive/Dist',
            isDirectory: true,
            isFile: false,
          },
          {
            name: 'docs',
            path: '/notes-root-recursive/docs',
            isDirectory: true,
            isFile: false,
          },
        ];
      }

      if (path === '/notes-root-recursive/Dist') {
        return Array.from({ length: 5000 }, (_, index) => ({
          name: `generated-${String(index).padStart(4, '0')}.md`,
          path: `/notes-root-recursive/Dist/generated-${String(index).padStart(4, '0')}.md`,
          isDirectory: false,
          isFile: true,
        }));
      }

      if (path === '/notes-root-recursive/docs') {
        return [
          {
            name: 'alpha.md',
            path: '/notes-root-recursive/docs/alpha.md',
            isDirectory: false,
            isFile: true,
          },
        ];
      }

      return [];
    });

    const tree = await buildFileTree('/notes-root-recursive');

    expect(findNode(tree, 'docs/alpha.md')).toEqual({
      id: 'docs/alpha.md',
      name: 'alpha',
      path: 'docs/alpha.md',
      isFolder: false,
    });
  });

  it('does not spend metadata scan budget on unsupported sibling files before markdown notes', async () => {
    adapter.listDir.mockResolvedValue([
      ...Array.from({ length: 6000 }, (_, index) => ({
        name: `asset-${index}.png`,
        isDirectory: false,
        isFile: true,
      })),
      {
        name: 'alpha.md',
        isDirectory: false,
        isFile: true,
      },
    ]);
    adapter.readFile.mockResolvedValue([
      '---',
      'vlaina_updated: "2026-04-17T00:00:00.000Z"',
      '---',
      '',
      '# Alpha',
    ].join('\n'));

    await expect(loadNoteMetadata('/notes-root-budget')).resolves.toEqual({
      version: 2,
      notes: {
        'alpha.md': {
          updatedAt: 1,
        },
      },
    });
  });

  it('does not spend metadata directory scan budget on unsupported files before late markdown notes', async () => {
    adapter.listDir.mockResolvedValue([
      ...Array.from({ length: 10_000 }, (_, index) => ({
        name: `asset-${index}.png`,
        isDirectory: false,
        isFile: true,
      })),
      {
        name: 'late.md',
        isDirectory: false,
        isFile: true,
      },
    ]);
    adapter.readFile.mockResolvedValue([
      '---',
      'vlaina_updated: "2026-04-18T00:00:00.000Z"',
      '---',
      '',
      '# Late',
    ].join('\n'));

    await expect(loadNoteMetadata('/notes-root-late-budget')).resolves.toEqual({
      version: 2,
      notes: {
        'late.md': {
          updatedAt: 1,
        },
      },
    });
  });

  it('does not spend metadata entry budget on sibling folders before markdown notes', async () => {
    adapter.listDir.mockImplementation(async (path: string) => {
      if (path === '/notes-root-metadata-folders') {
        return [
          ...Array.from({ length: 5000 }, (_, index) => ({
            name: `folder-${String(index).padStart(4, '0')}`,
            isDirectory: true,
            isFile: false,
          })),
          {
            name: 'late.md',
            isDirectory: false,
            isFile: true,
          },
        ];
      }

      return [];
    });
    adapter.readFile.mockResolvedValue([
      '---',
      'vlaina_updated: "2026-04-20T00:00:00.000Z"',
      '---',
      '',
      '# Late',
    ].join('\n'));

    await expect(loadNoteMetadata('/notes-root-metadata-folders')).resolves.toEqual({
      version: 2,
      notes: {
        'late.md': {
          updatedAt: 1,
        },
      },
    });
  });

  it('does not read metadata for markdown files whose nested relative path exceeds the opened folder path limit', async () => {
    const longFolder = 'd'.repeat(MAX_NOTES_ROOT_RELATIVE_PATH_CHARS - 2);
    const overlongPath = `${longFolder}/a.md`;

    adapter.listDir.mockImplementation(async (path: string) => {
      if (path === '/notes-root-overlong-metadata') {
        return [
          {
            name: longFolder,
            isDirectory: true,
            isFile: false,
          },
          {
            name: 'safe.md',
            isDirectory: false,
            isFile: true,
          },
        ];
      }

      if (path === `/notes-root-overlong-metadata/${longFolder}`) {
        return [
          {
            name: 'a.md',
            isDirectory: false,
            isFile: true,
          },
        ];
      }

      return [];
    });
    adapter.readFile.mockResolvedValue('# Safe');

    await expect(loadNoteMetadata('/notes-root-overlong-metadata')).resolves.toEqual({
      version: 2,
      notes: {
        'safe.md': {
          updatedAt: 1,
        },
      },
    });
    expect(adapter.readFile).toHaveBeenCalledWith('/notes-root-overlong-metadata/safe.md', 5 * 1024 * 1024);
    expect(adapter.readFile).not.toHaveBeenCalledWith(`/notes-root-overlong-metadata/${overlongPath}`, 5 * 1024 * 1024);
  });

  it('reads metadata for markdown files at the maximum scanned folder depth', async () => {
    const segments = Array.from({ length: 24 }, (_, index) => `level-${index}`);
    const deepRelativePath = `${segments.join('/')}/deep.md`;
    adapter.listDir.mockImplementation(async (path: string) => {
      const relative = path.replace(/^\/notes-root-depth\/?/, '');
      const depth = relative ? relative.split('/').filter(Boolean).length : 0;
      if (depth < segments.length) {
        return [{
          name: segments[depth],
          isDirectory: true,
          isFile: false,
        }];
      }
      return [{
        name: 'deep.md',
        isDirectory: false,
        isFile: true,
      }];
    });
    adapter.readFile.mockResolvedValue([
      '---',
      'vlaina_updated: "2026-04-19T00:00:00.000Z"',
      '---',
      '',
      '# Deep',
    ].join('\n'));

    await expect(loadNoteMetadata('/notes-root-depth')).resolves.toEqual({
      version: 2,
      notes: {
        [deepRelativePath]: {
          updatedAt: 1,
        },
      },
    });
  });
});
