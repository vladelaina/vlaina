import { beforeEach, describe, expect, it, vi } from 'vitest';
import { importExternalMarkdownEntries, resolveExternalMarkdownEntriesForStarred } from './externalMarkdownImport';

const MAX_EXTERNAL_MARKDOWN_FILE_SIZE = 10 * 1024 * 1024;

const mocks = vi.hoisted(() => {
  const storage = {
    stat: vi.fn(),
    copyFile: vi.fn(),
    readFile: vi.fn(),
    writeFile: vi.fn(),
    mkdir: vi.fn(),
    listDir: vi.fn(),
    deleteFile: vi.fn(),
    deleteDir: vi.fn(),
  };

  return {
    storage,
    authorizePath: vi.fn(),
    electronBridge: null as null | {
      dragDrop?: {
        authorizePath?: (path: string) => Promise<{
          name?: string;
          path?: string;
          isDirectory?: boolean;
          isFile?: boolean;
          size?: number;
        } | null>;
      };
    },
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
  normalizeAbsolutePath: (path: string) => path.replace(/\\/g, '/'),
  joinPath: async (...segments: string[]) => segments.filter(Boolean).join('/'),
  getStorageAdapter: () => mocks.storage,
}));

vi.mock('@/lib/electron/bridge', () => ({
  getElectronBridge: () => mocks.electronBridge,
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
    mocks.storage.readFile.mockReset();
    mocks.storage.writeFile.mockReset();
    mocks.storage.mkdir.mockReset();
    mocks.storage.listDir.mockReset();
    mocks.storage.deleteFile.mockReset();
    mocks.storage.deleteDir.mockReset();
    mocks.authorizePath.mockReset();
    mocks.electronBridge = null;
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
      fullPath: '/notesRoot/imports/alpha.markdown',
      fileName: 'alpha.markdown',
    });

    const result = await importExternalMarkdownEntries('/notesRoot', 'imports', ['/outside/alpha.markdown']);

    expect(result).toEqual({
      importedNotePaths: ['imports/alpha.markdown'],
      importedFolderPaths: [],
      didImport: true,
    });
    expect(mocks.resolveUniquePath).toHaveBeenCalledWith('/notesRoot', 'imports', 'alpha.markdown', false);
    expect(mocks.markExpectedExternalChange).toHaveBeenCalledWith('/notesRoot/imports/alpha.markdown');
    expect(mocks.storage.copyFile).toHaveBeenCalledWith('/outside/alpha.markdown', '/notesRoot/imports/alpha.markdown');
  });

  it('imports the authorized path when desktop authorization normalizes a dropped file path', async () => {
    mocks.electronBridge = {
      dragDrop: {
        authorizePath: mocks.authorizePath,
      },
    };
    mocks.authorizePath.mockResolvedValue({
      name: 'canonical.markdown',
      path: '/outside/canonical.markdown',
      isFile: true,
      isDirectory: false,
      size: 1024,
    });
    mocks.storage.stat.mockResolvedValue({
      isFile: true,
      isDirectory: false,
      size: 1024,
    });
    mocks.resolveUniquePath.mockResolvedValue({
      relativePath: 'imports/canonical.markdown',
      fullPath: '/notesRoot/imports/canonical.markdown',
      fileName: 'canonical.markdown',
    });

    const result = await importExternalMarkdownEntries('/notesRoot', 'imports', ['/tmp/link.md']);

    expect(result).toEqual({
      importedNotePaths: ['imports/canonical.markdown'],
      importedFolderPaths: [],
      didImport: true,
    });
    expect(mocks.authorizePath).toHaveBeenCalledWith('/tmp/link.md');
    expect(mocks.resolveUniquePath).toHaveBeenCalledWith('/notesRoot', 'imports', 'canonical.markdown', false);
    expect(mocks.storage.copyFile).toHaveBeenCalledWith(
      '/outside/canonical.markdown',
      '/notesRoot/imports/canonical.markdown',
    );
  });

  it('skips authorized import paths that resolve into internal note folders', async () => {
    mocks.electronBridge = {
      dragDrop: {
        authorizePath: mocks.authorizePath,
      },
    };
    mocks.authorizePath.mockResolvedValue({
      name: 'workspace.md',
      path: '/outside/.vlaina/workspace.md',
      isFile: true,
      isDirectory: false,
      size: 1024,
    });

    const result = await importExternalMarkdownEntries('/notesRoot', 'imports', ['/tmp/link.md']);

    expect(result).toEqual({
      importedNotePaths: [],
      importedFolderPaths: [],
      didImport: false,
    });
    expect(mocks.resolveUniquePath).not.toHaveBeenCalled();
    expect(mocks.storage.copyFile).not.toHaveBeenCalled();
  });

  it('skips authorized import paths that resolve to relative paths', async () => {
    mocks.electronBridge = {
      dragDrop: {
        authorizePath: mocks.authorizePath,
      },
    };
    mocks.authorizePath.mockResolvedValue({
      name: 'alpha.md',
      path: 'docs/alpha.md',
      isFile: true,
      isDirectory: false,
      size: 1024,
    });

    const result = await importExternalMarkdownEntries('/notesRoot', 'imports', ['/tmp/link.md']);

    expect(result).toEqual({
      importedNotePaths: [],
      importedFolderPaths: [],
      didImport: false,
    });
    expect(mocks.resolveUniquePath).not.toHaveBeenCalled();
    expect(mocks.storage.copyFile).not.toHaveBeenCalled();
  });

  it('skips external markdown files that are too large to open later', async () => {
    mocks.storage.stat.mockResolvedValue({
      isFile: true,
      isDirectory: false,
      size: 11 * 1024 * 1024,
    });

    const result = await importExternalMarkdownEntries('/notesRoot', 'imports', ['/outside/huge.md']);

    expect(result).toEqual({
      importedNotePaths: [],
      importedFolderPaths: [],
      didImport: false,
    });
    expect(mocks.storage.copyFile).not.toHaveBeenCalled();
  });

  it('skips external markdown files with invalid known source sizes', async () => {
    mocks.storage.stat.mockResolvedValue({
      isFile: true,
      isDirectory: false,
      size: -1,
    });

    const result = await importExternalMarkdownEntries('/notesRoot', 'imports', ['/outside/invalid.md']);

    expect(result).toEqual({
      importedNotePaths: [],
      importedFolderPaths: [],
      didImport: false,
    });
    expect(mocks.storage.readFile).not.toHaveBeenCalled();
    expect(mocks.storage.copyFile).not.toHaveBeenCalled();
  });

  it('imports a markdown file with bounded reads when source size is unavailable', async () => {
    mocks.storage.stat.mockImplementation(async (path: string) => ({
      isFile: path === '/outside/no-size.md' || path === '/notesRoot/imports/no-size.md',
      isDirectory: false,
    }));
    mocks.storage.readFile.mockResolvedValue('# No size');
    mocks.resolveUniquePath.mockResolvedValue({
      relativePath: 'imports/no-size.md',
      fullPath: '/notesRoot/imports/no-size.md',
      fileName: 'no-size.md',
    });

    const result = await importExternalMarkdownEntries('/notesRoot', 'imports', ['/outside/no-size.md']);

    expect(result).toEqual({
      importedNotePaths: ['imports/no-size.md'],
      importedFolderPaths: [],
      didImport: true,
    });
    expect(mocks.storage.readFile).toHaveBeenCalledWith('/outside/no-size.md', MAX_EXTERNAL_MARKDOWN_FILE_SIZE);
    expect(mocks.storage.writeFile).toHaveBeenCalledWith('/notesRoot/imports/no-size.md', '# No size');
    expect(mocks.storage.copyFile).not.toHaveBeenCalled();
  });

  it('skips markdown file imports that exceed the byte limit after bounded read', async () => {
    mocks.storage.stat.mockImplementation(async (path: string) => ({
      isFile: path === '/outside/no-size.md',
      isDirectory: false,
    }));
    mocks.storage.readFile.mockResolvedValue('你'.repeat(Math.floor(MAX_EXTERNAL_MARKDOWN_FILE_SIZE / 3) + 1));
    mocks.resolveUniquePath.mockResolvedValue({
      relativePath: 'imports/no-size.md',
      fullPath: '/notesRoot/imports/no-size.md',
      fileName: 'no-size.md',
    });

    const result = await importExternalMarkdownEntries('/notesRoot', 'imports', ['/outside/no-size.md']);

    expect(result).toEqual({
      importedNotePaths: [],
      importedFolderPaths: [],
      didImport: false,
    });
    expect(mocks.storage.readFile).toHaveBeenCalledWith('/outside/no-size.md', MAX_EXTERNAL_MARKDOWN_FILE_SIZE);
    expect(mocks.storage.writeFile).not.toHaveBeenCalled();
    expect(mocks.storage.copyFile).not.toHaveBeenCalled();
  });

  it('verifies copied markdown with a bounded read when copied size is unavailable', async () => {
    mocks.storage.stat.mockImplementation(async (path: string) => ({
      isFile: path === '/outside/alpha.md' || path === '/notesRoot/imports/alpha.md',
      isDirectory: false,
      ...(path === '/outside/alpha.md' ? { size: 1024 } : {}),
    }));
    mocks.storage.readFile.mockResolvedValue('# Alpha');
    mocks.resolveUniquePath.mockResolvedValue({
      relativePath: 'imports/alpha.md',
      fullPath: '/notesRoot/imports/alpha.md',
      fileName: 'alpha.md',
    });

    const result = await importExternalMarkdownEntries('/notesRoot', 'imports', ['/outside/alpha.md']);

    expect(result).toEqual({
      importedNotePaths: ['imports/alpha.md'],
      importedFolderPaths: [],
      didImport: true,
    });
    expect(mocks.storage.copyFile).toHaveBeenCalledWith('/outside/alpha.md', '/notesRoot/imports/alpha.md');
    expect(mocks.storage.readFile).toHaveBeenCalledWith('/notesRoot/imports/alpha.md', MAX_EXTERNAL_MARKDOWN_FILE_SIZE);
  });

  it('deletes copied markdown when copied size is unavailable and bounded verification fails', async () => {
    mocks.storage.stat.mockImplementation(async (path: string) => ({
      isFile: path === '/outside/alpha.md' || path === '/notesRoot/imports/alpha.md',
      isDirectory: false,
      ...(path === '/outside/alpha.md' ? { size: 1024 } : {}),
    }));
    mocks.storage.readFile.mockRejectedValue(new Error('File is too large to read'));
    mocks.resolveUniquePath.mockResolvedValue({
      relativePath: 'imports/alpha.md',
      fullPath: '/notesRoot/imports/alpha.md',
      fileName: 'alpha.md',
    });

    const result = await importExternalMarkdownEntries('/notesRoot', 'imports', ['/outside/alpha.md']);

    expect(result).toEqual({
      importedNotePaths: [],
      importedFolderPaths: [],
      didImport: false,
    });
    expect(mocks.storage.copyFile).toHaveBeenCalledWith('/outside/alpha.md', '/notesRoot/imports/alpha.md');
    expect(mocks.storage.readFile).toHaveBeenCalledWith('/notesRoot/imports/alpha.md', MAX_EXTERNAL_MARKDOWN_FILE_SIZE);
    expect(mocks.storage.deleteFile).toHaveBeenCalledWith('/notesRoot/imports/alpha.md');
  });

  it('keeps importing later files when one top-level path cannot be statted', async () => {
    mocks.storage.stat.mockImplementation(async (path: string) => {
      if (path === '/outside/locked.md') {
        throw new Error('Permission denied');
      }
      return {
        isFile: true,
        isDirectory: false,
        size: 1024,
      };
    });
    mocks.resolveUniquePath.mockResolvedValue({
      relativePath: 'imports/alpha.md',
      fullPath: '/notesRoot/imports/alpha.md',
      fileName: 'alpha.md',
    });

    const result = await importExternalMarkdownEntries('/notesRoot', 'imports', [
      '/outside/locked.md',
      '/outside/alpha.md',
    ]);

    expect(result).toEqual({
      importedNotePaths: ['imports/alpha.md'],
      importedFolderPaths: [],
      didImport: true,
    });
    expect(mocks.storage.copyFile).toHaveBeenCalledWith('/outside/alpha.md', '/notesRoot/imports/alpha.md');
  });

  it('does not spend top-level import budget on sibling folders before markdown files', async () => {
    mocks.storage.stat.mockImplementation(async (path: string) => {
      if (path.endsWith('.md')) {
        return {
          isFile: true,
          isDirectory: false,
          size: 1024,
        };
      }
      return {
        isFile: false,
        isDirectory: true,
      };
    });
    mocks.storage.listDir.mockResolvedValue([]);
    mocks.resolveUniquePath.mockImplementation(
      async (_notesRootPath: string, folderPath: string | undefined, name: string, _isDirectory: boolean) => {
        const relativePath = folderPath
          ? `${folderPath}/${name}`
          : `imports/${name}`;
        return {
          relativePath,
          fullPath: `/notesRoot/${relativePath}`,
          fileName: name,
        };
      },
    );

    const result = await importExternalMarkdownEntries('/notesRoot', 'imports', [
      ...Array.from({ length: 2000 }, (_value, index) => `/outside/folder-${String(index).padStart(4, '0')}`),
      '/outside/late.md',
    ]);

    expect(result).toEqual({
      importedNotePaths: ['imports/late.md'],
      importedFolderPaths: [],
      didImport: true,
    });
    expect(mocks.storage.copyFile).toHaveBeenCalledWith('/outside/late.md', '/notesRoot/imports/late.md');
  });

  it('keeps importing later files when one target path cannot be resolved', async () => {
    mocks.storage.stat.mockResolvedValue({
      isFile: true,
      isDirectory: false,
      size: 1024,
    });
    mocks.resolveUniquePath.mockImplementation(async (
      _notesRootPath: string,
      _folderPath: string | undefined,
      name: string,
    ) => {
      if (name === 'locked.md') {
        throw new Error('Cannot resolve target');
      }
      return {
        relativePath: `imports/${name}`,
        fullPath: `/notesRoot/imports/${name}`,
        fileName: name,
      };
    });

    const result = await importExternalMarkdownEntries('/notesRoot', 'imports', [
      '/outside/locked.md',
      '/outside/alpha.md',
    ]);

    expect(result).toEqual({
      importedNotePaths: ['imports/alpha.md'],
      importedFolderPaths: [],
      didImport: true,
    });
    expect(mocks.storage.copyFile).not.toHaveBeenCalledWith('/outside/locked.md', expect.any(String));
    expect(mocks.storage.copyFile).toHaveBeenCalledWith('/outside/alpha.md', '/notesRoot/imports/alpha.md');
  });

  it('keeps importing later files when one target directory cannot be created', async () => {
    mocks.storage.stat.mockImplementation(async (path: string) => ({
      isDirectory: path === '/outside/locked',
      isFile: path !== '/outside/locked',
      size: path.endsWith('.md') ? 1024 : undefined,
    }));
    mocks.storage.mkdir.mockRejectedValueOnce(new Error('Permission denied'));
    mocks.resolveUniquePath.mockImplementation(
      async (_notesRootPath: string, folderPath: string | undefined, name: string, isDirectory: boolean) => {
        const relativePath = folderPath
          ? `${folderPath}/${name}`
          : isDirectory
            ? `imports/${name}`
            : `imports/${name}`;
        return {
          relativePath,
          fullPath: `/notesRoot/${relativePath}`,
          fileName: name,
        };
      },
    );

    const result = await importExternalMarkdownEntries('/notesRoot', 'imports', [
      '/outside/locked',
      '/outside/alpha.md',
    ]);

    expect(result).toEqual({
      importedNotePaths: ['imports/alpha.md'],
      importedFolderPaths: [],
      didImport: true,
    });
    expect(mocks.storage.listDir).not.toHaveBeenCalledWith('/outside/locked', expect.anything());
    expect(mocks.storage.copyFile).toHaveBeenCalledWith('/outside/alpha.md', '/notesRoot/imports/alpha.md');
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
      async (_notesRootPath: string, folderPath: string | undefined, name: string, isDirectory: boolean) => {
        const relativePath = folderPath
          ? `${folderPath}/${name}`
          : isDirectory
            ? 'archive/docs'
            : name;

        return {
          relativePath,
          fullPath: `/notesRoot/${relativePath}`,
          fileName: relativePath.split('/').pop() || relativePath,
        };
      },
    );

    const result = await importExternalMarkdownEntries('/notesRoot', 'archive', ['/outside/docs']);

    expect(result).toEqual({
      importedNotePaths: ['archive/docs/alpha.md', 'archive/docs/guides/intro.markdown'],
      importedFolderPaths: ['archive/docs/guides', 'archive/docs'],
      didImport: true,
    });
    expect(mocks.storage.mkdir).toHaveBeenCalledWith('/notesRoot/archive/docs', true);
    expect(mocks.storage.mkdir).toHaveBeenCalledWith('/notesRoot/archive/docs/guides', true);
    expect(mocks.storage.copyFile).toHaveBeenCalledWith(
      '/outside/docs/alpha.md',
      '/notesRoot/archive/docs/alpha.md',
    );
    expect(mocks.storage.copyFile).toHaveBeenCalledWith(
      '/outside/docs/guides/intro.markdown',
      '/notesRoot/archive/docs/guides/intro.markdown',
    );
  });

  it('imports every supported markdown extension from folders', async () => {
    mocks.storage.stat.mockImplementation(async (path: string) => ({
      isDirectory: path === '/outside/docs',
      isFile: path !== '/outside/docs',
      size: /\.(?:md|markdown|mdown|mkd)$/i.test(path) ? 1024 : undefined,
    }));
    mocks.storage.listDir.mockResolvedValue([
      { name: 'alpha.md', isFile: true, isDirectory: false },
      { name: 'beta.markdown', isFile: true, isDirectory: false },
      { name: 'gamma.mdown', isFile: true, isDirectory: false },
      { name: 'delta.mkd', isFile: true, isDirectory: false },
      { name: 'image.png', isFile: true, isDirectory: false },
    ]);
    mocks.resolveUniquePath.mockImplementation(
      async (_notesRootPath: string, folderPath: string | undefined, name: string, isDirectory: boolean) => {
        const relativePath = folderPath
          ? `${folderPath}/${name}`
          : isDirectory
            ? `archive/${name}`
            : name;

        return {
          relativePath,
          fullPath: `/notesRoot/${relativePath}`,
          fileName: name,
        };
      },
    );

    const result = await importExternalMarkdownEntries('/notesRoot', 'archive', ['/outside/docs']);

    expect(result).toEqual({
      importedNotePaths: [
        'archive/docs/alpha.md',
        'archive/docs/beta.markdown',
        'archive/docs/gamma.mdown',
        'archive/docs/delta.mkd',
      ],
      importedFolderPaths: ['archive/docs'],
      didImport: true,
    });
    expect(mocks.storage.copyFile).toHaveBeenCalledTimes(4);
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
      async (_notesRootPath: string, folderPath: string | undefined, name: string, isDirectory: boolean) => {
        const relativePath = folderPath
          ? `${folderPath}/${name}`
          : isDirectory
            ? `archive/${name}`
            : name;
        return {
          relativePath,
          fullPath: `/notesRoot/${relativePath}`,
          fileName: name,
        };
      },
    );

    const result = await importExternalMarkdownEntries('/notesRoot', 'archive', ['/outside/project']);

    expect(result).toEqual({
      importedNotePaths: ['archive/project/alpha.md', 'archive/project/guides/intro.md'],
      importedFolderPaths: ['archive/project/guides', 'archive/project'],
      didImport: true,
    });
    expect(mocks.storage.copyFile).toHaveBeenCalledWith(
      '/outside/project/alpha.md',
      '/notesRoot/archive/project/alpha.md',
    );
    expect(mocks.storage.copyFile).toHaveBeenCalledWith(
      '/outside/project/guides/intro.md',
      '/notesRoot/archive/project/guides/intro.md',
    );
    expect(mocks.storage.deleteDir).toHaveBeenCalledWith('/notesRoot/archive/project/locked', true);
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
      async (_notesRootPath: string, folderPath: string | undefined, name: string) => {
        const relativePath = folderPath ? `${folderPath}/${name}` : name;
        return {
          relativePath,
          fullPath: `/notesRoot/${relativePath}`,
          fileName: name,
        };
      },
    );

    const result = await importExternalMarkdownEntries('/notesRoot', 'archive', ['/outside/docs']);

    expect(result).toEqual({
      importedNotePaths: ['archive/docs/safe.md'],
      importedFolderPaths: ['archive/docs'],
      didImport: true,
    });
    expect(mocks.storage.copyFile).toHaveBeenCalledWith(
      '/outside/docs/safe.md',
      '/notesRoot/archive/docs/safe.md',
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

  it('imports folder markdown entries with bounded reads when size cannot be verified', async () => {
    mocks.storage.stat.mockImplementation(async (path: string) => ({
      isDirectory: path === '/outside/docs' || path === '/notesRoot/archive/docs',
      isFile: path !== '/outside/docs' && path !== '/notesRoot/archive/docs',
    }));
    mocks.storage.listDir.mockResolvedValue([
      { name: 'no-size.md', isFile: true, isDirectory: false },
    ]);
    mocks.storage.readFile.mockResolvedValue('# No size');
    mocks.resolveUniquePath.mockImplementation(
      async (_notesRootPath: string, folderPath: string | undefined, name: string, isDirectory: boolean) => {
        const relativePath = folderPath
          ? `${folderPath}/${name}`
          : isDirectory
            ? `archive/${name}`
            : name;
        return {
          relativePath,
          fullPath: `/notesRoot/${relativePath}`,
          fileName: name,
        };
      },
    );

    const result = await importExternalMarkdownEntries('/notesRoot', 'archive', ['/outside/docs']);

    expect(result).toEqual({
      importedNotePaths: ['archive/docs/no-size.md'],
      importedFolderPaths: ['archive/docs'],
      didImport: true,
    });
    expect(mocks.storage.readFile).toHaveBeenCalledWith('/outside/docs/no-size.md', MAX_EXTERNAL_MARKDOWN_FILE_SIZE);
    expect(mocks.storage.writeFile).toHaveBeenCalledWith('/notesRoot/archive/docs/no-size.md', '# No size');
    expect(mocks.storage.copyFile).not.toHaveBeenCalled();
    expect(mocks.storage.deleteDir).not.toHaveBeenCalledWith('/notesRoot/archive/docs', true);
  });

  it('removes copied markdown when the target size exceeds the import limit', async () => {
    mocks.storage.stat.mockImplementation(async (path: string) => ({
      isDirectory: false,
      isFile: true,
      size: path.startsWith('/notesRoot/') ? 11 * 1024 * 1024 : 1024,
    }));
    mocks.resolveUniquePath.mockResolvedValue({
      relativePath: 'imports/huge.md',
      fullPath: '/notesRoot/imports/huge.md',
    });

    const result = await importExternalMarkdownEntries('/notesRoot', 'imports', ['/outside/huge.md']);

    expect(result).toEqual({
      importedNotePaths: [],
      importedFolderPaths: [],
      didImport: false,
    });
    expect(mocks.storage.copyFile).toHaveBeenCalledWith('/outside/huge.md', '/notesRoot/imports/huge.md');
    expect(mocks.storage.deleteFile).toHaveBeenCalledWith('/notesRoot/imports/huge.md');
  });

  it('removes copied markdown when the target size is invalid', async () => {
    mocks.storage.stat.mockImplementation(async (path: string) => ({
      isDirectory: false,
      isFile: true,
      size: path.startsWith('/notesRoot/') ? -1 : 1024,
    }));
    mocks.resolveUniquePath.mockResolvedValue({
      relativePath: 'imports/invalid.md',
      fullPath: '/notesRoot/imports/invalid.md',
    });

    const result = await importExternalMarkdownEntries('/notesRoot', 'imports', ['/outside/invalid.md']);

    expect(result).toEqual({
      importedNotePaths: [],
      importedFolderPaths: [],
      didImport: false,
    });
    expect(mocks.storage.copyFile).toHaveBeenCalledWith('/outside/invalid.md', '/notesRoot/imports/invalid.md');
    expect(mocks.storage.readFile).not.toHaveBeenCalled();
    expect(mocks.storage.deleteFile).toHaveBeenCalledWith('/notesRoot/imports/invalid.md');
  });

  it('keeps generated folders low priority without hiding markdown imports', async () => {
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
      async (_notesRootPath: string, folderPath: string | undefined, name: string, isDirectory: boolean) => {
        const relativePath = folderPath
          ? `${folderPath}/${name}`
          : isDirectory
            ? `archive/${name}`
            : name;
        return {
          relativePath,
          fullPath: `/notesRoot/${relativePath}`,
          fileName: name,
        };
      },
    );

    const result = await importExternalMarkdownEntries('/notesRoot', 'archive', ['/outside/project']);

    expect(result).toEqual({
      importedNotePaths: [
        'archive/project/docs/guide.md',
        'archive/project/node_modules/package.md',
      ],
      importedFolderPaths: [
        'archive/project/docs',
        'archive/project/node_modules',
        'archive/project',
      ],
      didImport: true,
    });
    expect(mocks.storage.listDir).toHaveBeenCalledWith('/outside/project/node_modules', { includeHidden: true });
    expect(mocks.storage.copyFile).toHaveBeenCalledWith(
      '/outside/project/node_modules/package.md',
      '/notesRoot/archive/project/node_modules/package.md',
    );
  });

  it('imports directly selected generated folders when they contain markdown', async () => {
    mocks.storage.stat.mockImplementation(async (path: string) => ({
      isFile: path !== '/outside/node_modules',
      isDirectory: path === '/outside/node_modules',
      size: path.endsWith('.md') ? 1024 : undefined,
    }));
    mocks.storage.listDir.mockResolvedValue([
      { name: 'package.md', isFile: true, isDirectory: false, size: 1024 },
    ]);
    mocks.resolveUniquePath.mockImplementation(
      async (_notesRootPath: string, folderPath: string | undefined, name: string, isDirectory: boolean) => {
        const relativePath = folderPath
          ? `${folderPath}/${name}`
          : isDirectory
            ? `archive/${name}`
            : name;
        return {
          relativePath,
          fullPath: `/notesRoot/${relativePath}`,
          fileName: name,
        };
      },
    );

    const result = await importExternalMarkdownEntries('/notesRoot', 'archive', ['/outside/node_modules']);

    expect(result).toEqual({
      importedNotePaths: ['archive/node_modules/package.md'],
      importedFolderPaths: ['archive/node_modules'],
      didImport: true,
    });
    expect(mocks.resolveUniquePath).toHaveBeenCalledWith('/notesRoot', 'archive', 'node_modules', true);
    expect(mocks.storage.mkdir).toHaveBeenCalledWith('/notesRoot/archive/node_modules', true);
    expect(mocks.storage.listDir).toHaveBeenCalledWith('/outside/node_modules', { includeHidden: true });
    expect(mocks.storage.copyFile).toHaveBeenCalledWith(
      '/outside/node_modules/package.md',
      '/notesRoot/archive/node_modules/package.md',
    );
  });

  it('stars existing notesRoot markdown files and folders without copying them', async () => {
    mocks.storage.stat.mockImplementation(async (path: string) => ({
      isDirectory: path === '/notesRoot/docs',
      isFile: path === '/notesRoot/docs/alpha.md',
    }));

    const result = await resolveExternalMarkdownEntriesForStarred('/notesRoot', [
      '/notesRoot/docs/alpha.md',
      '/notesRoot/docs',
    ]);

    expect(result).toEqual([
      {
        kind: 'note',
        notesRootPath: '/notesRoot',
        relativePath: 'docs/alpha.md',
      },
      {
        kind: 'folder',
        notesRootPath: '/notesRoot',
        relativePath: 'docs',
      },
    ]);
    expect(mocks.resolveUniquePath).not.toHaveBeenCalled();
    expect(mocks.storage.copyFile).not.toHaveBeenCalled();
    expect(mocks.storage.mkdir).not.toHaveBeenCalled();
  });

  it('stars existing root-notesRoot markdown files without copying them', async () => {
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
        notesRootPath: '/',
        relativePath: 'docs/alpha.md',
      },
      {
        kind: 'folder',
        notesRootPath: '/',
        relativePath: 'docs',
      },
    ]);
    expect(mocks.resolveUniquePath).not.toHaveBeenCalled();
    expect(mocks.storage.copyFile).not.toHaveBeenCalled();
    expect(mocks.storage.mkdir).not.toHaveBeenCalled();
  });

  it('stars outside markdown files without importing them into the opened folder', async () => {
    mocks.storage.stat.mockResolvedValue({
      isFile: true,
      isDirectory: false,
    });

    const result = await resolveExternalMarkdownEntriesForStarred('/notesRoot', ['/outside/alpha.md']);

    expect(result).toEqual([{
      kind: 'note',
      notesRootPath: '/outside',
      relativePath: 'alpha.md',
    }]);
    expect(mocks.resolveUniquePath).not.toHaveBeenCalled();
    expect(mocks.storage.copyFile).not.toHaveBeenCalled();
  });

  it('stars the authorized path when desktop authorization normalizes a dropped file path', async () => {
    mocks.electronBridge = {
      dragDrop: {
        authorizePath: mocks.authorizePath,
      },
    };
    mocks.authorizePath.mockResolvedValue({
      name: 'canonical.markdown',
      path: '/outside/canonical.markdown',
      isFile: true,
      isDirectory: false,
    });

    const result = await resolveExternalMarkdownEntriesForStarred('/notesRoot', ['/tmp/link.md']);

    expect(result).toEqual([{
      kind: 'note',
      notesRootPath: '/outside',
      relativePath: 'canonical.markdown',
    }]);
    expect(mocks.authorizePath).toHaveBeenCalledWith('/tmp/link.md');
    expect(mocks.resolveUniquePath).not.toHaveBeenCalled();
    expect(mocks.storage.copyFile).not.toHaveBeenCalled();
  });

  it('skips starred authorized paths that resolve to relative paths', async () => {
    mocks.electronBridge = {
      dragDrop: {
        authorizePath: mocks.authorizePath,
      },
    };
    mocks.authorizePath.mockResolvedValue({
      name: 'alpha.md',
      path: 'docs/alpha.md',
      isFile: true,
      isDirectory: false,
    });

    const result = await resolveExternalMarkdownEntriesForStarred('/notesRoot', ['/tmp/link.md']);

    expect(result).toEqual([]);
    expect(mocks.resolveUniquePath).not.toHaveBeenCalled();
    expect(mocks.storage.copyFile).not.toHaveBeenCalled();
  });

  it('keeps resolving later starred targets when one top-level path cannot be statted', async () => {
    mocks.storage.stat.mockImplementation(async (path: string) => {
      if (path === '/outside/locked.md') {
        throw new Error('Permission denied');
      }
      return {
        isFile: true,
        isDirectory: false,
      };
    });

    const result = await resolveExternalMarkdownEntriesForStarred('/notesRoot', [
      '/outside/locked.md',
      '/outside/alpha.md',
    ]);

    expect(result).toEqual([{
      kind: 'note',
      notesRootPath: '/outside',
      relativePath: 'alpha.md',
    }]);
    expect(mocks.resolveUniquePath).not.toHaveBeenCalled();
    expect(mocks.storage.copyFile).not.toHaveBeenCalled();
  });

  it('does not spend starred target budget on unsupported dropped files before markdown', async () => {
    mocks.storage.stat.mockImplementation(async (path: string) => ({
      isFile: true,
      isDirectory: false,
      size: path.endsWith('.md') ? 1024 : undefined,
    }));

    const paths = [
      ...Array.from({ length: 2000 }, (_, index) => `/outside/image-${index}.png`),
      '/outside/alpha.md',
    ];
    const result = await resolveExternalMarkdownEntriesForStarred('/notesRoot', paths);

    expect(result).toEqual([{
      kind: 'note',
      notesRootPath: '/outside',
      relativePath: 'alpha.md',
    }]);
    expect(mocks.storage.stat).toHaveBeenCalledWith('/outside/alpha.md');
  });

  it('stars outside folders without importing them into the opened folder', async () => {
    mocks.storage.stat.mockResolvedValue({
      isFile: false,
      isDirectory: true,
    });

    const result = await resolveExternalMarkdownEntriesForStarred('/notesRoot', ['/outside/docs']);

    expect(result).toEqual([{
      kind: 'folder',
      notesRootPath: '/outside',
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

    const result = await resolveExternalMarkdownEntriesForStarred('/notesRoot', paths);

    expect(result).toHaveLength(2000);
    expect(result[0]).toEqual({
      kind: 'note',
      notesRootPath: '/outside',
      relativePath: 'note-0.md',
    });
    expect(result.at(-1)).toEqual({
      kind: 'note',
      notesRootPath: '/outside',
      relativePath: 'note-1999.md',
    });
    expect(mocks.storage.stat).toHaveBeenCalledTimes(2000);
    expect(mocks.storage.stat).not.toHaveBeenCalledWith('/outside/note-2000.md');
  });
});
