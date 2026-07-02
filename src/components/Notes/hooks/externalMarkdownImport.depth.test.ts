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

describe('external markdown import depth', () => {
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

  it('imports markdown files at the maximum scanned folder depth without recursing deeper', async () => {
    const segments = Array.from({ length: 24 }, (_, index) => `level-${index}`);
    const sourceRoot = '/outside/project';
    const deepestSourceFolder = `${sourceRoot}/${segments.join('/')}`;
    const importedRelativeFile = `archive/project/${segments.join('/')}/deep.md`;

    mocks.storage.stat.mockImplementation(async (path: string) => ({
      isDirectory: path === sourceRoot || (path.startsWith(`${sourceRoot}/`) && !path.endsWith('.md')),
      isFile: path.endsWith('.md'),
      size: path.endsWith('.md') ? 1024 : undefined,
    }));
    mocks.storage.listDir.mockImplementation(async (path: string) => {
      if (path === sourceRoot || path.startsWith(`${sourceRoot}/`)) {
        const relative = path === sourceRoot ? '' : path.slice(sourceRoot.length + 1);
        const depth = relative ? relative.split('/').filter(Boolean).length : 0;
        if (depth < segments.length) {
          return [{
            name: segments[depth],
            isDirectory: true,
            isFile: false,
          }];
        }
        return [
          { name: 'deep.md', isDirectory: false, isFile: true },
          { name: 'too-deep', isDirectory: true, isFile: false },
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

    const result = await importExternalMarkdownEntries('/notesRoot', 'archive', [sourceRoot]);

    expect(result.importedNotePaths).toEqual([importedRelativeFile]);
    expect(result.importedFolderPaths).toContain(`archive/project/${segments.join('/')}`);
    expect(result.didImport).toBe(true);
    expect(mocks.storage.copyFile).toHaveBeenCalledWith(
      `${deepestSourceFolder}/deep.md`,
      `/notesRoot/${importedRelativeFile}`,
    );
    expect(mocks.storage.listDir).not.toHaveBeenCalledWith(`${deepestSourceFolder}/too-deep`, expect.anything());
  });
});
