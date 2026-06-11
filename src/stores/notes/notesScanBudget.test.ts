import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildFileTree } from './fileTreeUtils';
import { loadNoteMetadata } from './storage';

const adapter = {
  exists: vi.fn<(path: string) => Promise<boolean>>(),
  listDir: vi.fn<(path: string) => Promise<Array<{
    name: string;
    path?: string;
    isDirectory?: boolean;
    isFile?: boolean;
  }>>>(),
  readFile: vi.fn<(path: string) => Promise<string>>(),
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

  it('does not spend file tree budget on unsupported sibling files before markdown notes', async () => {
    adapter.listDir.mockResolvedValue([
      ...Array.from({ length: 6000 }, (_, index) => ({
        name: `image-${index}.png`,
        path: `/vault/image-${index}.png`,
        isDirectory: false,
        isFile: true,
      })),
      {
        name: 'alpha.md',
        path: '/vault/alpha.md',
        isDirectory: false,
        isFile: true,
      },
    ]);

    await expect(buildFileTree('/vault')).resolves.toEqual([
      {
        id: 'alpha.md',
        name: 'alpha',
        path: 'alpha.md',
        isFolder: false,
      },
    ]);
  });

  it('prioritizes markdown before capping non-markdown file tree scanning', async () => {
    adapter.listDir.mockResolvedValue([
      ...Array.from({ length: 10_000 }, (_, index) => ({
        name: `image-${index}.png`,
        path: `/vault/image-${index}.png`,
        isDirectory: false,
        isFile: true,
      })),
      {
        name: 'late.md',
        path: '/vault/late.md',
        isDirectory: false,
        isFile: true,
      },
    ]);

    await expect(buildFileTree('/vault')).resolves.toEqual([
      {
        id: 'late.md',
        name: 'late',
        path: 'late.md',
        isFolder: false,
      },
    ]);
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

    await expect(loadNoteMetadata('/vault-budget')).resolves.toEqual({
      version: 2,
      notes: {
        'alpha.md': {
          updatedAt: Date.parse('2026-04-17T00:00:00.000Z'),
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

    await expect(loadNoteMetadata('/vault-late-budget')).resolves.toEqual({
      version: 2,
      notes: {
        'late.md': {
          updatedAt: Date.parse('2026-04-18T00:00:00.000Z'),
        },
      },
    });
  });

  it('reads metadata for markdown files at the maximum scanned folder depth', async () => {
    const segments = Array.from({ length: 24 }, (_, index) => `level-${index}`);
    const deepRelativePath = `${segments.join('/')}/deep.md`;
    adapter.listDir.mockImplementation(async (path: string) => {
      const relative = path.replace(/^\/vault-depth\/?/, '');
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

    await expect(loadNoteMetadata('/vault-depth')).resolves.toEqual({
      version: 2,
      notes: {
        [deepRelativePath]: {
          updatedAt: Date.parse('2026-04-19T00:00:00.000Z'),
        },
      },
    });
  });
});
