import { beforeEach, describe, expect, it, vi } from 'vitest';
import { importExternalMarkdownEntries, resolveExternalMarkdownEntriesForStarred } from './externalMarkdownImport';

const mocks = vi.hoisted(() => {
  const storage = {
    stat: vi.fn(),
    copyFile: vi.fn(),
    mkdir: vi.fn(),
    listDir: vi.fn(),
    deleteFile: vi.fn(),
    deleteDir: vi.fn(),
  };

  return {
    storage,
    resolveUniquePath: vi.fn(),
    markExpectedExternalChange: vi.fn(),
  };
});

vi.mock('@/lib/storage/adapter', () => ({
  getBaseName: (path: string) => path.split(/[\\/]/).filter(Boolean).pop() || '',
  getParentPath: (path: string) => {
    const normalized = path.replace(/\\/g, '/').replace(/\/+$/, '');
    const lastSlashIndex = normalized.lastIndexOf('/');
    return lastSlashIndex === -1 ? null : normalized.slice(0, lastSlashIndex) || '/';
  },
  isAbsolutePath: (path: string) => path.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(path),
  joinPath: async (...segments: string[]) => segments.filter(Boolean).join('/'),
  getStorageAdapter: () => mocks.storage,
}));

vi.mock('@/stores/notes/utils/fs/pathOperations', () => ({
  resolveUniquePath: mocks.resolveUniquePath,
}));

vi.mock('@/stores/notes/document/externalChangeRegistry', () => ({
  markExpectedExternalChange: mocks.markExpectedExternalChange,
}));

describe('importExternalMarkdownEntries', () => {
  beforeEach(() => {
    mocks.storage.stat.mockReset();
    mocks.storage.copyFile.mockReset();
    mocks.storage.mkdir.mockReset();
    mocks.storage.listDir.mockReset();
    mocks.storage.deleteFile.mockReset();
    mocks.storage.deleteDir.mockReset();
    mocks.resolveUniquePath.mockReset();
    mocks.markExpectedExternalChange.mockReset();
  });

  it('imports a single markdown file into the target folder', async () => {
    mocks.storage.stat.mockResolvedValue({
      isFile: true,
      isDirectory: false,
      size: 1024,
    });
    mocks.resolveUniquePath.mockResolvedValue({
      relativePath: 'imports/alpha.markdown',
      fullPath: '/vault/imports/alpha.markdown',
      fileName: 'alpha.markdown',
    });

    const result = await importExternalMarkdownEntries('/vault', 'imports', ['/outside/alpha.markdown']);

    expect(result).toEqual({
      importedNotePaths: ['imports/alpha.markdown'],
      importedFolderPaths: [],
      didImport: true,
    });
    expect(mocks.resolveUniquePath).toHaveBeenCalledWith('/vault', 'imports', 'alpha.markdown', false);
    expect(mocks.markExpectedExternalChange).toHaveBeenCalledWith('/vault/imports/alpha.markdown');
    expect(mocks.storage.copyFile).toHaveBeenCalledWith('/outside/alpha.markdown', '/vault/imports/alpha.markdown');
  });

  it('skips external markdown files that are too large to open later', async () => {
    mocks.storage.stat.mockResolvedValue({
      isFile: true,
      isDirectory: false,
      size: 11 * 1024 * 1024,
    });

    const result = await importExternalMarkdownEntries('/vault', 'imports', ['/outside/huge.md']);

    expect(result).toEqual({
      importedNotePaths: [],
      importedFolderPaths: [],
      didImport: false,
    });
    expect(mocks.storage.copyFile).not.toHaveBeenCalled();
  });

  it('imports markdown files from folders and ignores non-markdown files', async () => {
    mocks.storage.stat.mockImplementation(async (path: string) => ({
      isDirectory: path === '/outside/docs' || path === '/outside/docs/guides',
      isFile: path !== '/outside/docs' && path !== '/outside/docs/guides',
      size: path.endsWith('.md') || path.endsWith('.markdown') ? 1024 : undefined,
    }));
    mocks.storage.listDir.mockImplementation(async (path: string) => {
      if (path === '/outside/docs') {
        return [
          { name: 'alpha.md', isFile: true, isDirectory: false },
          { name: 'notes.txt', isFile: true, isDirectory: false },
          { name: 'guides', isFile: false, isDirectory: true },
        ];
      }

      if (path === '/outside/docs/guides') {
        return [
          { name: 'intro.markdown', isFile: true, isDirectory: false },
        ];
      }

      return [];
    });
    mocks.resolveUniquePath.mockImplementation(
      async (_vaultPath: string, folderPath: string | undefined, name: string, isDirectory: boolean) => {
        const relativePath = folderPath
          ? `${folderPath}/${name}`
          : isDirectory
            ? 'archive/docs'
            : name;

        return {
          relativePath,
          fullPath: `/vault/${relativePath}`,
          fileName: relativePath.split('/').pop() || relativePath,
        };
      },
    );

    const result = await importExternalMarkdownEntries('/vault', 'archive', ['/outside/docs']);

    expect(result).toEqual({
      importedNotePaths: ['archive/docs/alpha.md', 'archive/docs/guides/intro.markdown'],
      importedFolderPaths: ['archive/docs/guides', 'archive/docs'],
      didImport: true,
    });
    expect(mocks.storage.mkdir).toHaveBeenCalledWith('/vault/archive/docs', true);
    expect(mocks.storage.mkdir).toHaveBeenCalledWith('/vault/archive/docs/guides', true);
    expect(mocks.storage.copyFile).toHaveBeenCalledWith(
      '/outside/docs/alpha.md',
      '/vault/archive/docs/alpha.md',
    );
    expect(mocks.storage.copyFile).toHaveBeenCalledWith(
      '/outside/docs/guides/intro.markdown',
      '/vault/archive/docs/guides/intro.markdown',
    );
  });

  it('keeps importing readable markdown when one nested folder cannot be listed', async () => {
    mocks.storage.stat.mockImplementation(async (path: string) => ({
      isDirectory: path === '/outside/project',
      isFile: path !== '/outside/project',
      size: path.endsWith('.md') ? 1024 : undefined,
    }));
    mocks.storage.listDir.mockImplementation(async (path: string) => {
      if (path === '/outside/project') {
        return [
          { name: 'alpha.md', isFile: true, isDirectory: false },
          { name: 'guides', isFile: false, isDirectory: true },
          { name: 'locked', isFile: false, isDirectory: true },
        ];
      }

      if (path === '/outside/project/guides') {
        return [
          { name: 'intro.md', isFile: true, isDirectory: false },
        ];
      }

      if (path === '/outside/project/locked') {
        throw new Error('Permission denied');
      }

      return [];
    });
    mocks.resolveUniquePath.mockImplementation(
      async (_vaultPath: string, folderPath: string | undefined, name: string, isDirectory: boolean) => {
        const relativePath = folderPath
          ? `${folderPath}/${name}`
          : isDirectory
            ? `archive/${name}`
            : name;
        return {
          relativePath,
          fullPath: `/vault/${relativePath}`,
          fileName: name,
        };
      },
    );

    const result = await importExternalMarkdownEntries('/vault', 'archive', ['/outside/project']);

    expect(result).toEqual({
      importedNotePaths: ['archive/project/alpha.md', 'archive/project/guides/intro.md'],
      importedFolderPaths: ['archive/project/guides', 'archive/project'],
      didImport: true,
    });
    expect(mocks.storage.copyFile).toHaveBeenCalledWith(
      '/outside/project/alpha.md',
      '/vault/archive/project/alpha.md',
    );
    expect(mocks.storage.copyFile).toHaveBeenCalledWith(
      '/outside/project/guides/intro.md',
      '/vault/archive/project/guides/intro.md',
    );
    expect(mocks.storage.deleteDir).toHaveBeenCalledWith('/vault/archive/project/locked', true);
  });

  it('ignores unsafe folder entry names while importing markdown folders', async () => {
    mocks.storage.stat.mockImplementation(async (path: string) => ({
      isDirectory: path === '/outside/docs',
      isFile: path !== '/outside/docs',
      size: path.endsWith('.md') ? 1024 : undefined,
    }));
    mocks.storage.listDir.mockImplementation(async (path: string) => {
      if (path === '/outside/docs') {
        return [
          { name: 'safe.md', isFile: true, isDirectory: false },
          { name: '../secret.md', isFile: true, isDirectory: false },
          { name: 'nested/evil.md', isFile: true, isDirectory: false },
          { name: 'bad\\evil.md', isFile: true, isDirectory: false },
          { name: '..', isFile: false, isDirectory: true },
        ];
      }

      return [];
    });
    mocks.resolveUniquePath.mockImplementation(
      async (_vaultPath: string, folderPath: string | undefined, name: string) => {
        const relativePath = folderPath ? `${folderPath}/${name}` : name;
        return {
          relativePath,
          fullPath: `/vault/${relativePath}`,
          fileName: name,
        };
      },
    );

    const result = await importExternalMarkdownEntries('/vault', 'archive', ['/outside/docs']);

    expect(result).toEqual({
      importedNotePaths: ['archive/docs/safe.md'],
      importedFolderPaths: ['archive/docs'],
      didImport: true,
    });
    expect(mocks.storage.copyFile).toHaveBeenCalledWith(
      '/outside/docs/safe.md',
      '/vault/archive/docs/safe.md',
    );
    expect(mocks.storage.copyFile).not.toHaveBeenCalledWith(
      '/outside/docs/../secret.md',
      expect.any(String),
    );
    expect(mocks.storage.copyFile).not.toHaveBeenCalledWith(
      '/outside/docs/nested/evil.md',
      expect.any(String),
    );
    expect(mocks.storage.listDir).not.toHaveBeenCalledWith('/outside/docs/..');
  });

  it('skips folder markdown entries when size cannot be verified', async () => {
    mocks.storage.stat.mockImplementation(async (path: string) => ({
      isDirectory: path === '/outside/docs',
      isFile: path !== '/outside/docs',
    }));
    mocks.storage.listDir.mockResolvedValue([
      { name: 'huge.md', isFile: true, isDirectory: false },
    ]);
    mocks.resolveUniquePath.mockResolvedValue({
      relativePath: 'archive/docs',
      fullPath: '/vault/archive/docs',
    });

    const result = await importExternalMarkdownEntries('/vault', 'archive', ['/outside/docs']);

    expect(result).toEqual({
      importedNotePaths: [],
      importedFolderPaths: [],
      didImport: false,
    });
    expect(mocks.storage.copyFile).not.toHaveBeenCalled();
    expect(mocks.storage.deleteDir).toHaveBeenCalledWith('/vault/archive/docs', true);
  });

  it('removes copied markdown when the target size exceeds the import limit', async () => {
    mocks.storage.stat.mockImplementation(async (path: string) => ({
      isDirectory: false,
      isFile: true,
      size: path.startsWith('/vault/') ? 11 * 1024 * 1024 : 1024,
    }));
    mocks.resolveUniquePath.mockResolvedValue({
      relativePath: 'imports/huge.md',
      fullPath: '/vault/imports/huge.md',
    });

    const result = await importExternalMarkdownEntries('/vault', 'imports', ['/outside/huge.md']);

    expect(result).toEqual({
      importedNotePaths: [],
      importedFolderPaths: [],
      didImport: false,
    });
    expect(mocks.storage.copyFile).toHaveBeenCalledWith('/outside/huge.md', '/vault/imports/huge.md');
    expect(mocks.storage.deleteFile).toHaveBeenCalledWith('/vault/imports/huge.md');
  });

  it('does not recurse into generated folders while importing markdown folders', async () => {
    mocks.storage.stat.mockImplementation(async (path: string) => ({
      isDirectory: path === '/outside/project',
      isFile: path !== '/outside/project',
      size: path.endsWith('.md') ? 1024 : undefined,
    }));
    mocks.storage.listDir.mockImplementation(async (path: string) => {
      if (path === '/outside/project') {
        return [
          { name: 'docs', isFile: false, isDirectory: true },
          { name: 'node_modules', isFile: false, isDirectory: true },
        ];
      }

      if (path === '/outside/project/docs') {
        return [
          { name: 'guide.md', isFile: true, isDirectory: false },
        ];
      }

      if (path === '/outside/project/node_modules') {
        return [
          { name: 'package.md', isFile: true, isDirectory: false },
        ];
      }

      return [];
    });
    mocks.resolveUniquePath.mockImplementation(
      async (_vaultPath: string, folderPath: string | undefined, name: string, isDirectory: boolean) => {
        const relativePath = folderPath
          ? `${folderPath}/${name}`
          : isDirectory
            ? `archive/${name}`
            : name;
        return {
          relativePath,
          fullPath: `/vault/${relativePath}`,
          fileName: name,
        };
      },
    );

    const result = await importExternalMarkdownEntries('/vault', 'archive', ['/outside/project']);

    expect(result).toEqual({
      importedNotePaths: ['archive/project/docs/guide.md'],
      importedFolderPaths: ['archive/project/docs', 'archive/project'],
      didImport: true,
    });
    expect(mocks.storage.listDir).not.toHaveBeenCalledWith('/outside/project/node_modules');
    expect(mocks.storage.copyFile).not.toHaveBeenCalledWith(
      '/outside/project/node_modules/package.md',
      expect.any(String),
    );
  });

  it('does not import directly selected generated folders', async () => {
    mocks.storage.stat.mockResolvedValue({
      isFile: false,
      isDirectory: true,
    });

    const result = await importExternalMarkdownEntries('/vault', 'archive', ['/outside/node_modules']);

    expect(result).toEqual({
      importedNotePaths: [],
      importedFolderPaths: [],
      didImport: false,
    });
    expect(mocks.resolveUniquePath).not.toHaveBeenCalled();
    expect(mocks.storage.mkdir).not.toHaveBeenCalled();
    expect(mocks.storage.listDir).not.toHaveBeenCalled();
  });

  it('stars existing vault markdown files and folders without copying them', async () => {
    mocks.storage.stat.mockImplementation(async (path: string) => ({
      isDirectory: path === '/vault/docs',
      isFile: path === '/vault/docs/alpha.md',
    }));

    const result = await resolveExternalMarkdownEntriesForStarred('/vault', [
      '/vault/docs/alpha.md',
      '/vault/docs',
    ]);

    expect(result).toEqual([
      {
        kind: 'note',
        vaultPath: '/vault',
        relativePath: 'docs/alpha.md',
      },
      {
        kind: 'folder',
        vaultPath: '/vault',
        relativePath: 'docs',
      },
    ]);
    expect(mocks.resolveUniquePath).not.toHaveBeenCalled();
    expect(mocks.storage.copyFile).not.toHaveBeenCalled();
    expect(mocks.storage.mkdir).not.toHaveBeenCalled();
  });

  it('stars existing root-vault markdown files without copying them', async () => {
    mocks.storage.stat.mockImplementation(async (path: string) => ({
      isDirectory: path === '/docs',
      isFile: path === '/docs/alpha.md',
    }));

    const result = await resolveExternalMarkdownEntriesForStarred('/', [
      '/docs/alpha.md',
      '/docs',
    ]);

    expect(result).toEqual([
      {
        kind: 'note',
        vaultPath: '/',
        relativePath: 'docs/alpha.md',
      },
      {
        kind: 'folder',
        vaultPath: '/',
        relativePath: 'docs',
      },
    ]);
    expect(mocks.resolveUniquePath).not.toHaveBeenCalled();
    expect(mocks.storage.copyFile).not.toHaveBeenCalled();
    expect(mocks.storage.mkdir).not.toHaveBeenCalled();
  });

  it('stars outside markdown files without importing them into the current vault', async () => {
    mocks.storage.stat.mockResolvedValue({
      isFile: true,
      isDirectory: false,
    });

    const result = await resolveExternalMarkdownEntriesForStarred('/vault', ['/outside/alpha.md']);

    expect(result).toEqual([{
      kind: 'note',
      vaultPath: '/outside',
      relativePath: 'alpha.md',
    }]);
    expect(mocks.resolveUniquePath).not.toHaveBeenCalled();
    expect(mocks.storage.copyFile).not.toHaveBeenCalled();
  });

  it('stars outside folders without importing them into the current vault', async () => {
    mocks.storage.stat.mockResolvedValue({
      isFile: false,
      isDirectory: true,
    });

    const result = await resolveExternalMarkdownEntriesForStarred('/vault', ['/outside/docs']);

    expect(result).toEqual([{
      kind: 'folder',
      vaultPath: '/outside',
      relativePath: 'docs',
    }]);
    expect(mocks.resolveUniquePath).not.toHaveBeenCalled();
    expect(mocks.storage.mkdir).not.toHaveBeenCalled();
  });

  it('limits starred target resolution for very large dropped path lists', async () => {
    mocks.storage.stat.mockResolvedValue({
      isFile: true,
      isDirectory: false,
    });
    const paths = Array.from({ length: 2005 }, (_, index) => `/outside/note-${index}.md`);

    const result = await resolveExternalMarkdownEntriesForStarred('/vault', paths);

    expect(result).toHaveLength(2000);
    expect(result[0]).toEqual({
      kind: 'note',
      vaultPath: '/outside',
      relativePath: 'note-0.md',
    });
    expect(result.at(-1)).toEqual({
      kind: 'note',
      vaultPath: '/outside',
      relativePath: 'note-1999.md',
    });
    expect(mocks.storage.stat).toHaveBeenCalledTimes(2000);
    expect(mocks.storage.stat).not.toHaveBeenCalledWith('/outside/note-2000.md');
  });
});
