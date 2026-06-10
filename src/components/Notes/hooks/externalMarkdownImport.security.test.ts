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

  it('skips unsafe starred drop paths before statting them', async () => {
    const result = await resolveExternalMarkdownEntriesForStarred('/vault', [
      '/outside/docs\u202E',
      '/outside/secret\uFFFD.md',
    ]);

    expect(result).toEqual([]);
    expect(mocks.storage.stat).not.toHaveBeenCalled();
  });
});
