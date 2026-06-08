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

function mockResolvedImportPaths() {
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
}

describe('importExternalMarkdownEntries dotfiles', () => {
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

  it('imports user dotfile notes and dot folders from dropped folders', async () => {
    mocks.storage.stat.mockImplementation(async (path: string) => ({
      isDirectory: path === '/outside/docs' || path === '/outside/docs/.notes',
      isFile: path !== '/outside/docs' && path !== '/outside/docs/.notes',
      size: path.endsWith('.md') ? 1024 : undefined,
    }));
    mocks.storage.listDir.mockImplementation(async (path: string) => {
      if (path === '/outside/docs') {
        return [
          { name: '.journal.md', isFile: true, isDirectory: false },
          { name: '.notes', isFile: false, isDirectory: true },
          { name: '.vlaina', isFile: false, isDirectory: true },
          { name: '.git', isFile: false, isDirectory: true },
        ];
      }

      if (path === '/outside/docs/.notes') {
        return [
          { name: 'alpha.md', isFile: true, isDirectory: false },
        ];
      }

      return [
        { name: 'internal.md', isFile: true, isDirectory: false },
      ];
    });
    mockResolvedImportPaths();

    const result = await importExternalMarkdownEntries('/vault', 'archive', ['/outside/docs']);

    expect(result).toEqual({
      importedNotePaths: ['archive/docs/.journal.md', 'archive/docs/.notes/alpha.md'],
      importedFolderPaths: ['archive/docs/.notes', 'archive/docs'],
      didImport: true,
    });
    expect(mocks.storage.listDir).toHaveBeenCalledWith('/outside/docs', { includeHidden: true });
    expect(mocks.storage.listDir).toHaveBeenCalledWith('/outside/docs/.notes', { includeHidden: true });
    expect(mocks.storage.listDir).not.toHaveBeenCalledWith('/outside/docs/.vlaina');
    expect(mocks.storage.listDir).not.toHaveBeenCalledWith('/outside/docs/.git');
    expect(mocks.storage.copyFile).toHaveBeenCalledWith(
      '/outside/docs/.journal.md',
      '/vault/archive/docs/.journal.md',
    );
    expect(mocks.storage.copyFile).toHaveBeenCalledWith(
      '/outside/docs/.notes/alpha.md',
      '/vault/archive/docs/.notes/alpha.md',
    );
  });

  it('imports a directly selected user dot folder', async () => {
    mocks.storage.stat.mockImplementation(async (path: string) => ({
      isDirectory: path === '/outside/.notes',
      isFile: path !== '/outside/.notes',
      size: path.endsWith('.md') ? 1024 : undefined,
    }));
    mocks.storage.listDir.mockResolvedValue([
      { name: 'alpha.md', isFile: true, isDirectory: false },
    ]);
    mockResolvedImportPaths();

    const result = await importExternalMarkdownEntries('/vault', 'archive', ['/outside/.notes']);

    expect(result).toEqual({
      importedNotePaths: ['archive/.notes/alpha.md'],
      importedFolderPaths: ['archive/.notes'],
      didImport: true,
    });
    expect(mocks.storage.listDir).toHaveBeenCalledWith('/outside/.notes', { includeHidden: true });
    expect(mocks.storage.copyFile).toHaveBeenCalledWith(
      '/outside/.notes/alpha.md',
      '/vault/archive/.notes/alpha.md',
    );
  });

  it('does not import directly selected internal dot folders', async () => {
    mocks.storage.stat.mockResolvedValue({
      isFile: false,
      isDirectory: true,
    });

    const result = await importExternalMarkdownEntries('/vault', 'archive', [
      '/outside/.vlaina',
      '/outside/.git',
      '/outside/.VLAINA',
      '/outside/.GIT',
    ]);

    expect(result).toEqual({
      importedNotePaths: [],
      importedFolderPaths: [],
      didImport: false,
    });
    expect(mocks.resolveUniquePath).not.toHaveBeenCalled();
    expect(mocks.storage.mkdir).not.toHaveBeenCalled();
    expect(mocks.storage.listDir).not.toHaveBeenCalled();
  });
});
