import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  importExternalMarkdownEntries,
  resolveExternalMarkdownEntriesForStarred,
} from './externalMarkdownImport';

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

describe('external markdown import path security', () => {
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

  it('skips directly imported paths with unsafe characters before statting them', async () => {
    const result = await importExternalMarkdownEntries('/vault', 'imports', [
      '/outside/docs\u202E',
      '/outside/secret\uFFFD.md',
    ]);

    expect(result).toEqual({
      importedNotePaths: [],
      importedFolderPaths: [],
      didImport: false,
    });
    expect(mocks.storage.stat).not.toHaveBeenCalled();
    expect(mocks.storage.copyFile).not.toHaveBeenCalled();
    expect(mocks.storage.listDir).not.toHaveBeenCalled();
  });

  it('skips URL-like external import paths before statting them', async () => {
    const result = await importExternalMarkdownEntries('/vault', 'imports', [
      'https://example.com/alpha.md',
      'file:///outside/alpha.md',
      'asset://localhost/alpha.md',
    ]);

    expect(result).toEqual({
      importedNotePaths: [],
      importedFolderPaths: [],
      didImport: false,
    });
    expect(mocks.storage.stat).not.toHaveBeenCalled();
    expect(mocks.storage.copyFile).not.toHaveBeenCalled();
  });

  it('allows Windows absolute paths while still validating their path segments', async () => {
    mocks.storage.stat.mockImplementation(async (path: string) => ({
      isFile: path === 'C:\\Users\\me\\alpha.md' || path === '/vault/imports/alpha.md',
      isDirectory: false,
      size: 1024,
    }));
    mocks.resolveUniquePath.mockResolvedValue({
      relativePath: 'imports/alpha.md',
      fullPath: '/vault/imports/alpha.md',
      fileName: 'alpha.md',
    });

    const result = await importExternalMarkdownEntries('/vault', 'imports', [
      'C:\\Users\\me\\alpha.md',
      'C:\\Users\\me\\bad\u202E.md',
    ]);

    expect(result).toEqual({
      importedNotePaths: ['imports/alpha.md'],
      importedFolderPaths: [],
      didImport: true,
    });
    expect(mocks.storage.stat).toHaveBeenCalledWith('C:\\Users\\me\\alpha.md');
    expect(mocks.storage.stat).not.toHaveBeenCalledWith('C:\\Users\\me\\bad\u202E.md');
    expect(mocks.storage.copyFile).toHaveBeenCalledWith(
      'C:\\Users\\me\\alpha.md',
      '/vault/imports/alpha.md',
    );
  });

  it('skips unsafe starred drop paths before statting them', async () => {
    const result = await resolveExternalMarkdownEntriesForStarred('/vault', [
      '/outside/docs\u202E',
      '/outside/secret\uFFFD.md',
    ]);

    expect(result).toEqual([]);
    expect(mocks.storage.stat).not.toHaveBeenCalled();
  });

  it('skips URL-like starred drop paths before statting them', async () => {
    const result = await resolveExternalMarkdownEntriesForStarred('/vault', [
      'https://example.com/alpha.md',
      'file:///outside/alpha.md',
      'asset://localhost/alpha.md',
    ]);

    expect(result).toEqual([]);
    expect(mocks.storage.stat).not.toHaveBeenCalled();
  });

  it('allows Windows absolute starred paths while still validating their path segments', async () => {
    mocks.storage.stat.mockResolvedValue({
      isFile: true,
      isDirectory: false,
    });

    const result = await resolveExternalMarkdownEntriesForStarred('/vault', [
      'C:\\Users\\me\\alpha.md',
      'C:\\Users\\me\\bad\u202E.md',
    ]);

    expect(result).toEqual([{
      kind: 'note',
      vaultPath: 'C:/Users/me',
      relativePath: 'alpha.md',
    }]);
    expect(mocks.storage.stat).toHaveBeenCalledWith('C:\\Users\\me\\alpha.md');
    expect(mocks.storage.stat).not.toHaveBeenCalledWith('C:\\Users\\me\\bad\u202E.md');
  });
});
