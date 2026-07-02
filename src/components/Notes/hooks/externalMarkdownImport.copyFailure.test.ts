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

describe('importExternalMarkdownEntries copy failures', () => {
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

  it('skips a markdown file that fails to copy while importing later files', async () => {
    mocks.storage.stat.mockImplementation(async (path: string) => ({
      isDirectory: path === '/outside/docs',
      isFile: path !== '/outside/docs',
      size: path.endsWith('.md') ? 1024 : undefined,
    }));
    mocks.storage.listDir.mockResolvedValue([
      { name: 'locked.md', isFile: true, isDirectory: false },
      { name: 'alpha.md', isFile: true, isDirectory: false },
    ]);
    mocks.storage.copyFile.mockImplementation(async (sourcePath: string) => {
      if (sourcePath.endsWith('/locked.md')) {
        throw new Error('Permission denied');
      }
    });
    mocks.resolveUniquePath.mockImplementation(
      async (_notesRootPath: string, folderPath: string | undefined, name: string, isDirectory: boolean) => {
        const relativePath = folderPath
          ? `${folderPath}/${name}`
          : isDirectory
            ? `imports/${name}`
            : name;
        return {
          relativePath,
          fullPath: `/notesRoot/${relativePath}`,
          fileName: name,
        };
      },
    );

    const result = await importExternalMarkdownEntries('/notesRoot', 'imports', ['/outside/docs']);

    expect(result).toEqual({
      importedNotePaths: ['imports/docs/alpha.md'],
      importedFolderPaths: ['imports/docs'],
      didImport: true,
    });
    expect(mocks.storage.copyFile).toHaveBeenCalledWith(
      '/outside/docs/locked.md',
      '/notesRoot/imports/docs/locked.md',
    );
    expect(mocks.storage.copyFile).toHaveBeenCalledWith(
      '/outside/docs/alpha.md',
      '/notesRoot/imports/docs/alpha.md',
    );
    expect(mocks.storage.deleteFile).toHaveBeenCalledWith('/notesRoot/imports/docs/locked.md');
    expect(mocks.storage.deleteDir).not.toHaveBeenCalledWith('/notesRoot/imports/docs', true);
  });
});
