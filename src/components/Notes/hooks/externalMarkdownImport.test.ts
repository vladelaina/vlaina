import { beforeEach, describe, expect, it, vi } from 'vitest';
import { importExternalMarkdownEntries } from './externalMarkdownImport';

const mocks = vi.hoisted(() => {
  const storage = {
    stat: vi.fn(),
    copyFile: vi.fn(),
    mkdir: vi.fn(),
    listDir: vi.fn(),
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
  getExtension: (path: string) => {
    const name = path.split(/[\\/]/).filter(Boolean).pop() || '';
    const lastDot = name.lastIndexOf('.');
    return lastDot === -1 ? '' : name.slice(lastDot + 1);
  },
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
    mocks.storage.deleteDir.mockReset();
    mocks.resolveUniquePath.mockReset();
    mocks.markExpectedExternalChange.mockReset();
  });

  it('imports a single markdown file into the target folder', async () => {
    mocks.storage.stat.mockResolvedValue({
      isFile: true,
      isDirectory: false,
    });
    mocks.resolveUniquePath.mockResolvedValue({
      relativePath: 'imports/alpha.md',
      fullPath: '/vault/imports/alpha.md',
      fileName: 'alpha.md',
    });

    const result = await importExternalMarkdownEntries('/vault', 'imports', ['/outside/alpha.markdown']);

    expect(result).toEqual({
      importedNotePaths: ['imports/alpha.md'],
      importedFolderPaths: [],
    });
    expect(mocks.markExpectedExternalChange).toHaveBeenCalledWith('/vault/imports/alpha.md');
    expect(mocks.storage.copyFile).toHaveBeenCalledWith('/outside/alpha.markdown', '/vault/imports/alpha.md');
  });

  it('imports markdown files from folders and ignores non-markdown files', async () => {
    mocks.storage.stat.mockImplementation(async (path: string) => ({
      isDirectory: path === '/outside/docs' || path === '/outside/docs/guides',
      isFile: path !== '/outside/docs' && path !== '/outside/docs/guides',
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
          ? `${folderPath}/${isDirectory ? name : name.replace(/\.(markdown|mdown|mkd)$/i, '.md')}`
          : isDirectory
            ? 'archive/docs'
            : name.replace(/\.(markdown|mdown|mkd)$/i, '.md');

        return {
          relativePath,
          fullPath: `/vault/${relativePath}`,
          fileName: relativePath.split('/').pop() || relativePath,
        };
      },
    );

    const result = await importExternalMarkdownEntries('/vault', 'archive', ['/outside/docs']);

    expect(result).toEqual({
      importedNotePaths: ['archive/docs/alpha.md', 'archive/docs/guides/intro.md'],
      importedFolderPaths: ['archive/docs/guides', 'archive/docs'],
    });
    expect(mocks.storage.mkdir).toHaveBeenCalledWith('/vault/archive/docs', true);
    expect(mocks.storage.mkdir).toHaveBeenCalledWith('/vault/archive/docs/guides', true);
    expect(mocks.storage.copyFile).toHaveBeenCalledWith(
      '/outside/docs/alpha.md',
      '/vault/archive/docs/alpha.md',
    );
    expect(mocks.storage.copyFile).toHaveBeenCalledWith(
      '/outside/docs/guides/intro.markdown',
      '/vault/archive/docs/guides/intro.md',
    );
  });
});
