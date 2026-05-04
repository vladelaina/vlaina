import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createEmptyMetadataFile,
  loadNoteMetadata,
  saveWorkspaceState,
  setNoteEntry,
} from './storage';
import type { MetadataFile } from './types';

const adapter = {
  exists: vi.fn<(path: string) => Promise<boolean>>(),
  readFile: vi.fn<(path: string) => Promise<string>>(),
  writeFile: vi.fn<(path: string, content: string) => Promise<void>>(),
  mkdir: vi.fn<(path: string, recursive?: boolean) => Promise<void>>(),
  getBasePath: vi.fn<() => Promise<string>>(),
  stat: vi.fn<(path: string) => Promise<{ modifiedAt?: number; size?: number } | null>>(),
  listDir: vi.fn<
    (path: string) => Promise<Array<{ name: string; isDirectory?: boolean; isFile?: boolean }>>
  >(),
};

vi.mock('@/lib/storage/adapter', () => ({
  getStorageAdapter: () => adapter,
  joinPath: (...segments: string[]) => Promise.resolve(segments.join('/')),
}));

describe('notes metadata storage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    adapter.exists.mockResolvedValue(false);
    adapter.getBasePath.mockResolvedValue('/app');
    adapter.stat.mockImplementation(async (path: string) => ({
      modifiedAt: path.includes('alpha') ? 1 : 2,
      size: path.includes('alpha') ? 100 : 200,
    }));
  });

  it('scans markdown frontmatter into the runtime metadata index', async () => {
    adapter.listDir.mockImplementation(async (path: string) => {
      if (path === '/vault-a') {
        return [
          { name: 'alpha.md', isFile: true },
          { name: 'docs', isDirectory: true },
          { name: '.vlaina', isDirectory: true },
        ];
      }

      if (path === '/vault-a/docs') {
        return [{ name: 'beta.md', isFile: true }];
      }

      return [];
    });

    adapter.readFile.mockImplementation(async (path: string) => {
      if (path === '/vault-a/alpha.md') {
        return [
          '---',
          'vlaina_cover: "assets/alpha.webp"',
          'vlaina_cover_x: 12',
          'vlaina_cover_y: 24',
          'vlaina_cover_height: 260',
          'vlaina_cover_scale: 1.4',
          'vlaina_icon: "🐱"',
          'vlaina_created: "2026-04-15T00:00:00.000Z"',
          'vlaina_updated: "2026-04-16T00:00:00.000Z"',
          '---',
          '',
          '# Alpha',
        ].join('\n');
      }

      return [
        '---',
        'title: Beta',
        '',
        'vlaina_updated: "2026-04-17T00:00:00.000Z"',
        '---',
        '',
        '# Beta',
      ].join('\n');
    });

    await expect(loadNoteMetadata('/vault-a')).resolves.toEqual({
      version: 2,
      notes: {
        'alpha.md': {
          cover: {
            assetPath: 'assets/alpha.webp',
            positionX: 12,
            positionY: 24,
            height: 260,
            scale: 1.4,
          },
          icon: '🐱',
          createdAt: Date.parse('2026-04-15T00:00:00.000Z'),
          updatedAt: Date.parse('2026-04-16T00:00:00.000Z'),
        },
        'docs/beta.md': {
          updatedAt: Date.parse('2026-04-17T00:00:00.000Z'),
        },
      },
    });
  });

  it('reuses cached metadata when file stats are unchanged', async () => {
    adapter.listDir.mockResolvedValue([
      { name: 'alpha.md', isFile: true },
    ]);
    adapter.readFile.mockResolvedValue([
      '---',
      'vlaina_updated: "2026-04-17T00:00:00.000Z"',
      '---',
      '',
      '# Alpha',
    ].join('\n'));
    adapter.stat.mockResolvedValue({ modifiedAt: 7, size: 80 });

    await loadNoteMetadata('/vault-cache');
    await loadNoteMetadata('/vault-cache');

    expect(adapter.readFile).toHaveBeenCalledTimes(1);
  });

  it('does not cache metadata when file stats are unavailable', async () => {
    adapter.listDir.mockResolvedValue([
      { name: 'alpha.md', isFile: true },
    ]);
    adapter.readFile.mockResolvedValue('# Alpha');
    adapter.stat.mockResolvedValue(null);

    await loadNoteMetadata('/vault-no-stat');
    await loadNoteMetadata('/vault-no-stat');

    expect(adapter.readFile).toHaveBeenCalledTimes(2);
  });

  it('creates an empty metadata file shape when needed', () => {
    expect(createEmptyMetadataFile()).toEqual({
      version: 2,
      notes: {},
    });
  });

  it('stores workspace state in the system config folder instead of the vault folder', async () => {
    await saveWorkspaceState('/vault-a', {
      currentNotePath: 'alpha.md',
      expandedFolders: ['docs'],
      fileTreeSortMode: 'updated-desc',
    });

    expect(adapter.mkdir).toHaveBeenCalledWith(
      '/app/.vlaina/store/notes/vaults/vault-1dwgd8k',
      true
    );
    expect(adapter.writeFile).toHaveBeenCalledWith(
      '/app/.vlaina/store/notes/vaults/vault-1dwgd8k/workspace.json',
      JSON.stringify({
        currentNotePath: 'alpha.md',
        expandedFolders: ['docs'],
        fileTreeSortMode: 'updated-desc',
      }, null, 2)
    );
  });

  it('drops empty cover payloads when updating metadata', () => {
    const metadata: MetadataFile = {
      version: 2,
      notes: {
        'alpha.md': {
          cover: {
            assetPath: 'assets/alpha.webp',
            positionX: 50,
            positionY: 50,
          },
        },
      },
    };

    expect(setNoteEntry(metadata, 'alpha.md', { cover: undefined })).toEqual({
      version: 2,
      notes: {},
    });
  });
});
