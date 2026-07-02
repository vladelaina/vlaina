import { beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveExternalMarkdownEntriesForStarred } from './externalMarkdownImport';

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

describe('resolveExternalMarkdownEntriesForStarred security', () => {
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

  it('does not expose hidden app or git paths from the opened folder as starred targets', async () => {
    mocks.storage.stat.mockImplementation(async (path: string) => ({
      isDirectory: path.endsWith('/.vlaina') || path.endsWith('/.git'),
      isFile: path.endsWith('.md'),
    }));

    const result = await resolveExternalMarkdownEntriesForStarred('/notesRoot', [
      '/notesRoot/.vlaina/workspace.md',
      '/notesRoot/docs/.git/config.md',
      '/notesRoot/.vlaina',
      '/notesRoot/.git',
      '/notesRoot/.VLAINA/workspace.md',
      '/notesRoot/docs/.GIT/config.md',
      '/notesRoot/.VLAINA',
      '/notesRoot/.GIT',
    ]);

    expect(result).toEqual([]);
  });

  it('allows user dot folders and dotfile markdown outside the opened folder', async () => {
    mocks.storage.stat.mockImplementation(async (path: string) => ({
      isDirectory: path === '/outside/.notes',
      isFile: path === '/outside/.journal.md',
    }));

    const result = await resolveExternalMarkdownEntriesForStarred('/notesRoot', [
      '/outside/.notes',
      '/outside/.journal.md',
    ]);

    expect(result).toEqual([
      {
        kind: 'note',
        notesRootPath: '/outside',
        relativePath: '.journal.md',
      },
      {
        kind: 'folder',
        notesRootPath: '/outside',
        relativePath: '.notes',
      },
    ]);
  });

  it('does not create external starred targets from paths with unsafe parent folders', async () => {
    mocks.storage.stat.mockImplementation(async (path: string) => ({
      isDirectory: path.endsWith('/docs'),
      isFile: path.endsWith('/alpha.md'),
    }));

    const result = await resolveExternalMarkdownEntriesForStarred('/notesRoot', [
      '/outside\u202Ecod/docs',
      '/outside\u202Ecod/alpha.md',
      '/outside\u001Fcontrol/docs',
      '/outside\uFFFDreplacement/alpha.md',
    ]);

    expect(result).toEqual([]);
  });
});
