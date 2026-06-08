import { beforeEach, describe, expect, it, vi } from 'vitest';
import { importExternalMarkdownEntries } from './externalMarkdownImport';

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
  normalizeAbsolutePath: (path: string) => path.replace(/\\/g, '/'),
  joinPath: async (...segments: string[]) => segments.filter(Boolean).join('/'),
  getStorageAdapter: () => mocks.storage,
}));

vi.mock('@/stores/notes/utils/fs/pathOperations', () => ({
  resolveUniquePath: mocks.resolveUniquePath,
}));

vi.mock('@/stores/notes/document/externalChangeRegistry', () => ({
  markExpectedExternalChange: mocks.markExpectedExternalChange,
}));

describe('importExternalMarkdownEntries budget', () => {
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

  it('does not spend folder import budget on unsupported files before markdown', async () => {
    mocks.storage.stat.mockImplementation(async (path: string) => ({
      isDirectory: path === '/outside/docs',
      isFile: path !== '/outside/docs',
      size: path.endsWith('.md') ? 1024 : undefined,
    }));
    mocks.storage.listDir.mockResolvedValue([
      ...Array.from({ length: 2000 }, (_, index) => ({
        name: `image-${index}.png`,
        isFile: true,
        isDirectory: false,
      })),
      { name: 'alpha.md', isFile: true, isDirectory: false },
    ]);
    mocks.resolveUniquePath.mockImplementation(
      async (_vaultPath: string, folderPath: string | undefined, name: string, isDirectory: boolean) => {
        const relativePath = folderPath
          ? `${folderPath}/${name}`
          : isDirectory
            ? `imports/${name}`
            : name;
        return {
          relativePath,
          fullPath: `/vault/${relativePath}`,
          fileName: name,
        };
      },
    );

    const result = await importExternalMarkdownEntries('/vault', 'imports', ['/outside/docs']);

    expect(result).toEqual({
      importedNotePaths: ['imports/docs/alpha.md'],
      importedFolderPaths: ['imports/docs'],
      didImport: true,
    });
    expect(mocks.storage.copyFile).toHaveBeenCalledTimes(1);
    expect(mocks.storage.copyFile).toHaveBeenCalledWith(
      '/outside/docs/alpha.md',
      '/vault/imports/docs/alpha.md',
    );
  });

  it('does not spend top-level import budget on unsupported files before markdown', async () => {
    mocks.storage.stat.mockImplementation(async (path: string) => ({
      isDirectory: false,
      isFile: true,
      size: path.endsWith('.md') ? 1024 : undefined,
    }));
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

    const paths = [
      ...Array.from({ length: 2000 }, (_, index) => `/outside/image-${index}.png`),
      '/outside/alpha.md',
    ];
    const result = await importExternalMarkdownEntries('/vault', 'imports', paths);

    expect(result).toEqual({
      importedNotePaths: ['imports/alpha.md'],
      importedFolderPaths: [],
      didImport: true,
    });
    expect(mocks.storage.copyFile).toHaveBeenCalledTimes(1);
    expect(mocks.storage.copyFile).toHaveBeenCalledWith(
      '/outside/alpha.md',
      '/vault/imports/alpha.md',
    );
  });

  it('skips generated folder names case-insensitively before recursing', async () => {
    mocks.storage.stat.mockImplementation(async (path: string) => ({
      isDirectory: path === '/outside/project',
      isFile: path.endsWith('.md'),
      size: path.endsWith('.md') ? 1024 : undefined,
    }));
    mocks.storage.listDir.mockImplementation(async (path: string) => {
      if (path === '/outside/project') {
        return [
          { name: 'Node_Modules', isFile: false, isDirectory: true },
          { name: 'Dist', isFile: false, isDirectory: true },
          { name: 'docs', isFile: false, isDirectory: true },
        ];
      }

      if (path === '/outside/project/docs') {
        return [
          { name: 'alpha.md', isFile: true, isDirectory: false, size: 1024 },
        ];
      }

      return [
        { name: 'hidden.md', isFile: true, isDirectory: false, size: 1024 },
      ];
    });
    mocks.resolveUniquePath.mockImplementation(
      async (_vaultPath: string, folderPath: string | undefined, name: string, isDirectory: boolean) => {
        const relativePath = folderPath
          ? `${folderPath}/${name}`
          : isDirectory
            ? `imports/${name}`
            : name;
        return {
          relativePath,
          fullPath: `/vault/${relativePath}`,
          fileName: name,
        };
      },
    );

    const result = await importExternalMarkdownEntries('/vault', 'imports', ['/outside/project']);

    expect(result).toEqual({
      importedNotePaths: ['imports/project/docs/alpha.md'],
      importedFolderPaths: ['imports/project/docs', 'imports/project'],
      didImport: true,
    });
    expect(mocks.storage.listDir).not.toHaveBeenCalledWith('/outside/project/Node_Modules', { includeHidden: true });
    expect(mocks.storage.listDir).not.toHaveBeenCalledWith('/outside/project/Dist', { includeHidden: true });
    expect(mocks.storage.copyFile).toHaveBeenCalledTimes(1);
  });
});
