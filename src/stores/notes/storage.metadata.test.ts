import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createEmptyMetadataFile,
  loadGlobalNoteIconSize,
  loadRecentNotes,
  loadWorkspaceState,
  loadNoteMetadata,
  persistGlobalNoteIconSize,
  saveWorkspaceState,
  setNoteEntry,
} from './storage';
import type { MetadataFile } from './types';

const MAX_METADATA_READ_BYTES = 5 * 1024 * 1024;

const adapter = {
  exists: vi.fn<(path: string) => Promise<boolean>>(),
  readFile: vi.fn<(path: string, maxBytes?: number) => Promise<string>>(),
  writeFile: vi.fn<(path: string, content: string) => Promise<void>>(),
  mkdir: vi.fn<(path: string, recursive?: boolean) => Promise<void>>(),
  getBasePath: vi.fn<() => Promise<string>>(),
  stat: vi.fn<(path: string) => Promise<{ modifiedAt?: number; size?: number } | null>>(),
  listDir: vi.fn<
    (
      path: string,
      options?: { includeHidden?: boolean; recursive?: boolean },
    ) => Promise<Array<{ name: string; isDirectory?: boolean; isFile?: boolean }>>
  >(),
};

vi.mock('@/lib/storage/adapter', () => ({
  getStorageAdapter: () => adapter,
  isAbsolutePath: (path: string) => path.startsWith('/') || /^[A-Za-z]:[\\/]/.test(path),
  joinPath: (...segments: string[]) => Promise.resolve(segments.join('/')),
}));

describe('notes metadata storage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
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

  it('scans metadata from every supported markdown extension', async () => {
    adapter.listDir.mockResolvedValue([
      { name: 'alpha.md', isFile: true },
      { name: 'beta.markdown', isFile: true },
      { name: 'gamma.mdown', isFile: true },
      { name: 'delta.mkd', isFile: true },
      { name: 'image.png', isFile: true },
    ]);
    adapter.readFile.mockResolvedValue('# Note');

    await expect(loadNoteMetadata('/vault-extensions')).resolves.toEqual({
      version: 2,
      notes: {},
    });
    expect(adapter.readFile).toHaveBeenCalledWith('/vault-extensions/alpha.md', MAX_METADATA_READ_BYTES);
    expect(adapter.readFile).toHaveBeenCalledWith('/vault-extensions/beta.markdown', MAX_METADATA_READ_BYTES);
    expect(adapter.readFile).toHaveBeenCalledWith('/vault-extensions/gamma.mdown', MAX_METADATA_READ_BYTES);
    expect(adapter.readFile).toHaveBeenCalledWith('/vault-extensions/delta.mkd', MAX_METADATA_READ_BYTES);
    expect(adapter.readFile).not.toHaveBeenCalledWith('/vault-extensions/image.png');
  });

  it('scans user dotfile notes while hiding internal app and git folders', async () => {
    adapter.listDir.mockImplementation(async (path: string) => {
      if (path === '/vault-dot-notes') {
        return [
          { name: '.journal.md', isFile: true },
          { name: '.notes', isDirectory: true },
          { name: '.vlaina', isDirectory: true },
          { name: '.git', isDirectory: true },
          { name: '.VLAINA', isDirectory: true },
          { name: '.GIT', isDirectory: true },
        ];
      }

      if (path === '/vault-dot-notes/.notes') {
        return [{ name: 'alpha.md', isFile: true }];
      }

      return [];
    });
    adapter.readFile.mockImplementation(async (path: string) => {
      const date = path.includes('alpha')
        ? '2026-04-18T00:00:00.000Z'
        : '2026-04-17T00:00:00.000Z';

      return [
        '---',
        `vlaina_updated: "${date}"`,
        '---',
        '',
        '# Note',
      ].join('\n');
    });

    await expect(loadNoteMetadata('/vault-dot-notes')).resolves.toEqual({
      version: 2,
      notes: {
        '.journal.md': {
          updatedAt: Date.parse('2026-04-17T00:00:00.000Z'),
        },
        '.notes/alpha.md': {
          updatedAt: Date.parse('2026-04-18T00:00:00.000Z'),
        },
      },
    });
    expect(adapter.listDir).toHaveBeenCalledWith('/vault-dot-notes', { includeHidden: true });
    expect(adapter.listDir).toHaveBeenCalledWith('/vault-dot-notes/.notes', { includeHidden: true });
    expect(adapter.listDir).not.toHaveBeenCalledWith('/vault-dot-notes/.vlaina');
    expect(adapter.listDir).not.toHaveBeenCalledWith('/vault-dot-notes/.git');
    expect(adapter.listDir).not.toHaveBeenCalledWith('/vault-dot-notes/.VLAINA');
    expect(adapter.listDir).not.toHaveBeenCalledWith('/vault-dot-notes/.GIT');
  });

  it('ignores unsafe storage entry names during metadata scans', async () => {
    adapter.listDir.mockImplementation(async (path: string) => {
      if (path === '/vault-unsafe') {
        return [
          { name: 'alpha.md', isFile: true },
          { name: '../secret.md', isFile: true },
          { name: 'nested/evil.md', isFile: true },
          { name: 'bad\\evil.md', isFile: true },
          { name: '..', isDirectory: true },
          { name: 'docs', isDirectory: true },
        ];
      }

      if (path === '/vault-unsafe/docs') {
        return [{ name: 'beta.md', isFile: true }];
      }

      return [];
    });
    adapter.readFile.mockResolvedValue('# Note');

    await expect(loadNoteMetadata('/vault-unsafe')).resolves.toEqual({
      version: 2,
      notes: {},
    });
    expect(adapter.listDir).not.toHaveBeenCalledWith('/vault-unsafe/..');
    expect(adapter.readFile).toHaveBeenCalledWith('/vault-unsafe/alpha.md', MAX_METADATA_READ_BYTES);
    expect(adapter.readFile).toHaveBeenCalledWith('/vault-unsafe/docs/beta.md', MAX_METADATA_READ_BYTES);
    expect(adapter.readFile).not.toHaveBeenCalledWith('/vault-unsafe/../secret.md');
    expect(adapter.readFile).not.toHaveBeenCalledWith('/vault-unsafe/nested/evil.md');
    expect(adapter.readFile).not.toHaveBeenCalledWith('/vault-unsafe/bad\\evil.md');
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

  it('does not read metadata when file stats are unavailable', async () => {
    adapter.listDir.mockResolvedValue([
      { name: 'alpha.md', isFile: true },
    ]);
    adapter.readFile.mockResolvedValue('# Alpha');
    adapter.stat.mockResolvedValue(null);

    await loadNoteMetadata('/vault-no-stat');
    await loadNoteMetadata('/vault-no-stat');

    expect(adapter.readFile).not.toHaveBeenCalled();
  });

  it('does not read oversized markdown files during metadata scans', async () => {
    adapter.listDir.mockResolvedValue([
      { name: 'huge.md', isFile: true },
    ]);
    adapter.stat.mockResolvedValue({ modifiedAt: 7, size: 6 * 1024 * 1024 });

    await expect(loadNoteMetadata('/vault-huge')).resolves.toEqual({
      version: 2,
      notes: {},
    });
    expect(adapter.readFile).not.toHaveBeenCalled();
  });

  it('does not parse metadata content that exceeds the metadata limit after read', async () => {
    adapter.listDir.mockResolvedValue([
      { name: 'huge.md', isFile: true },
    ]);
    adapter.stat.mockResolvedValue({ modifiedAt: 7, size: 32 });
    adapter.readFile.mockResolvedValue('x'.repeat(5 * 1024 * 1024 + 1));

    await expect(loadNoteMetadata('/vault-huge-after-read')).resolves.toEqual({
      version: 2,
      notes: {},
    });
    expect(adapter.readFile).toHaveBeenCalledWith('/vault-huge-after-read/huge.md', MAX_METADATA_READ_BYTES);
  });

  it('keeps generated folders low priority without hiding markdown metadata', async () => {
    adapter.listDir.mockImplementation(async (path: string) => {
      if (path === '/vault-heavy') {
        return [
          { name: 'node_modules', isDirectory: true },
          { name: 'Node_Modules', isDirectory: true },
          { name: 'Dist', isDirectory: true },
          { name: 'docs', isDirectory: true },
        ];
      }

      if (path === '/vault-heavy/docs') {
        return [{ name: 'alpha.md', isFile: true }];
      }

      if (path === '/vault-heavy/node_modules') {
        return [{ name: 'package.md', isFile: true }];
      }

      if (path === '/vault-heavy/Node_Modules') {
        return [{ name: 'package.md', isFile: true }];
      }

      if (path === '/vault-heavy/Dist') {
        return [{ name: 'bundle.md', isFile: true }];
      }

      return [];
    });
    adapter.readFile.mockResolvedValue([
      '---',
      'vlaina_updated: "2026-04-17T00:00:00.000Z"',
      '---',
      '',
      '# Alpha',
    ].join('\n'));

    await expect(loadNoteMetadata('/vault-heavy')).resolves.toEqual({
      version: 2,
      notes: {
        'Dist/bundle.md': {
          updatedAt: Date.parse('2026-04-17T00:00:00.000Z'),
        },
        'docs/alpha.md': {
          updatedAt: Date.parse('2026-04-17T00:00:00.000Z'),
        },
        'node_modules/package.md': {
          updatedAt: Date.parse('2026-04-17T00:00:00.000Z'),
        },
        'Node_Modules/package.md': {
          updatedAt: Date.parse('2026-04-17T00:00:00.000Z'),
        },
      },
    });
    expect(adapter.listDir).toHaveBeenCalledWith('/vault-heavy/node_modules', { includeHidden: true });
    expect(adapter.listDir).toHaveBeenCalledWith('/vault-heavy/Node_Modules', { includeHidden: true });
    expect(adapter.listDir).toHaveBeenCalledWith('/vault-heavy/Dist', { includeHidden: true });
  });

  it('prioritizes markdown and folders before capping non-markdown metadata scanning', async () => {
    adapter.listDir.mockImplementation(async (path: string) => {
      if (path === '/vault-many-assets') {
        return [
          ...Array.from({ length: 10_000 }, (_, index) => ({ name: `asset-${index}.png`, isFile: true })),
          { name: 'late.md', isFile: true },
          { name: 'late-folder', isDirectory: true },
        ];
      }

      if (path === '/vault-many-assets/late-folder') {
        return [{ name: 'nested.md', isFile: true }];
      }

      return [];
    });
    adapter.readFile.mockResolvedValue([
      '---',
      'vlaina_updated: "2026-04-17T00:00:00.000Z"',
      '---',
      '',
      '# Late',
    ].join('\n'));

    await expect(loadNoteMetadata('/vault-many-assets')).resolves.toEqual({
      version: 2,
      notes: {
        'late-folder/nested.md': {
          updatedAt: Date.parse('2026-04-17T00:00:00.000Z'),
        },
        'late.md': {
          updatedAt: Date.parse('2026-04-17T00:00:00.000Z'),
        },
      },
    });
    expect(adapter.readFile).toHaveBeenCalledWith('/vault-many-assets/late.md', MAX_METADATA_READ_BYTES);
    expect(adapter.readFile).toHaveBeenCalledWith('/vault-many-assets/late-folder/nested.md', MAX_METADATA_READ_BYTES);
  });

  it('keeps readable sibling metadata when one nested folder cannot be listed', async () => {
    adapter.listDir.mockImplementation(async (path: string) => {
      if (path === '/vault-partial-failure') {
        return [
          { name: 'root.md', isFile: true },
          { name: 'docs', isDirectory: true },
          { name: 'locked', isDirectory: true },
        ];
      }

      if (path === '/vault-partial-failure/docs') {
        return [{ name: 'inside.md', isFile: true }];
      }

      if (path === '/vault-partial-failure/locked') {
        throw new Error('Permission denied');
      }

      return [];
    });
    adapter.readFile.mockImplementation(async (path: string) => {
      const date = path.includes('inside')
        ? '2026-04-18T00:00:00.000Z'
        : '2026-04-17T00:00:00.000Z';

      return [
        '---',
        `vlaina_updated: "${date}"`,
        '---',
        '',
        '# Note',
      ].join('\n');
    });

    await expect(loadNoteMetadata('/vault-partial-failure')).resolves.toEqual({
      version: 2,
      notes: {
        'root.md': {
          updatedAt: Date.parse('2026-04-17T00:00:00.000Z'),
        },
        'docs/inside.md': {
          updatedAt: Date.parse('2026-04-18T00:00:00.000Z'),
        },
      },
    });
  });

  it('creates an empty metadata file shape when needed', () => {
    expect(createEmptyMetadataFile()).toEqual({
      version: 2,
      notes: {},
    });
  });

  it('normalizes global note icon size from storage and persistence writes', () => {
    localStorage.setItem('vlaina-note-icon-size', '72');
    expect(loadGlobalNoteIconSize()).toBe(72);

    expect(persistGlobalNoteIconSize(-1)).toBe(60);
    expect(localStorage.getItem('vlaina-note-icon-size')).toBe('60');
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

  it('merges expanded workspace folders from disk before saving', async () => {
    adapter.exists.mockResolvedValue(true);
    adapter.stat.mockResolvedValue({ size: 128 });
    adapter.readFile.mockResolvedValue(JSON.stringify({
      currentNotePath: 'beta.md',
      expandedFolders: ['archive'],
      fileTreeSortMode: 'name-asc',
    }));

    await saveWorkspaceState('/vault-a', {
      currentNotePath: 'alpha.md',
      expandedFolders: ['docs'],
      fileTreeSortMode: 'updated-desc',
    });

    expect(adapter.writeFile).toHaveBeenCalledWith(
      '/app/.vlaina/store/notes/vaults/vault-1dwgd8k/workspace.json',
      JSON.stringify({
        currentNotePath: 'alpha.md',
        expandedFolders: ['archive', 'docs'],
        fileTreeSortMode: 'updated-desc',
      }, null, 2)
    );
  });

  it('caps merged expanded workspace folders before saving', async () => {
    adapter.exists.mockResolvedValue(true);
    adapter.stat.mockResolvedValue({ size: 128 });
    adapter.readFile.mockResolvedValue(JSON.stringify({
      currentNotePath: 'beta.md',
      expandedFolders: Array.from({ length: 5000 }, (_, index) => `disk-${index}`),
      fileTreeSortMode: 'name-asc',
    }));

    await saveWorkspaceState('/vault-a', {
      currentNotePath: 'alpha.md',
      expandedFolders: Array.from({ length: 5000 }, (_, index) => `current-${index}`),
      fileTreeSortMode: 'updated-desc',
    });

    const [, writtenContent] = adapter.writeFile.mock.calls.at(-1) ?? [];
    expect(JSON.parse(writtenContent as string)).toEqual({
      currentNotePath: 'alpha.md',
      expandedFolders: Array.from({ length: 5000 }, (_, index) => `disk-${index}`),
      fileTreeSortMode: 'updated-desc',
    });
  });

  it('sanitizes recent note paths loaded from localStorage', () => {
    localStorage.setItem(
      'vlaina-recent-notes',
      JSON.stringify(['docs/alpha.md', '../secret.md', '/etc/passwd.md', 'docs/alpha.md', 'draft:local.md', 'image.png'])
    );

    expect(loadRecentNotes()).toEqual(['docs/alpha.md']);
  });

  it('sanitizes workspace state loaded from disk', async () => {
    adapter.exists.mockResolvedValue(true);
    adapter.stat.mockResolvedValue({ size: 128 });
    adapter.readFile.mockResolvedValue(
      JSON.stringify({
        currentNotePath: '../secret.md',
        expandedFolders: ['docs', '../escape', 'docs', '/tmp'],
        fileTreeSortMode: 'unexpected',
      })
    );

    await expect(loadWorkspaceState('/vault-a')).resolves.toEqual({
      currentNotePath: null,
      expandedFolders: ['docs'],
      fileTreeSortMode: undefined,
    });
  });

  it('does not restore draft pseudo paths from workspace state', async () => {
    adapter.exists.mockResolvedValue(true);
    adapter.stat.mockResolvedValue({ size: 128 });
    adapter.readFile.mockResolvedValue(
      JSON.stringify({
        currentNotePath: 'draft:local.md',
      })
    );

    await expect(loadWorkspaceState('/vault-a')).resolves.toEqual({
      currentNotePath: null,
      expandedFolders: [],
      fileTreeSortMode: undefined,
    });
  });

  it('does not read workspace state files when stat has no size', async () => {
    adapter.exists.mockResolvedValue(true);
    adapter.stat.mockResolvedValue(null);

    await expect(loadWorkspaceState('/vault-a')).resolves.toBeNull();
    expect(adapter.readFile).not.toHaveBeenCalled();
  });

  it('does not read oversized workspace state files', async () => {
    adapter.exists.mockResolvedValue(true);
    adapter.stat.mockResolvedValue({ size: 300 * 1024 });

    await expect(loadWorkspaceState('/vault-a')).resolves.toBeNull();
    expect(adapter.readFile).not.toHaveBeenCalled();
  });

  it('does not parse workspace state content that exceeds the limit after read', async () => {
    adapter.exists.mockResolvedValue(true);
    adapter.stat.mockResolvedValue({ size: 128 });
    adapter.readFile.mockResolvedValue('x'.repeat(256 * 1024 + 1));

    await expect(loadWorkspaceState('/vault-a')).resolves.toBeNull();
    expect(adapter.readFile).toHaveBeenCalled();
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
