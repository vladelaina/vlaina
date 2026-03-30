import { beforeEach, describe, expect, it, vi } from 'vitest';

const deleteFileMock = vi.fn();
const deleteDirMock = vi.fn();

vi.mock('@/lib/storage/adapter', () => ({
  getStorageAdapter: () => ({
    deleteFile: deleteFileMock,
    deleteDir: deleteDirMock,
  }),
  joinPath: (...parts: string[]) => Promise.resolve(parts.join('/')),
}));

vi.mock('../../starred', () => ({
  getVaultStarredPaths: () => ({ notes: [], folders: [] }),
  remapStarredEntriesForVault: (entries: unknown[]) => ({ entries, changed: false }),
  saveStarredRegistry: vi.fn(),
}));

vi.mock('../../document/externalChangeRegistry', () => ({
  markExpectedExternalChange: vi.fn(),
}));

import { deleteFolderImpl, deleteNoteImpl } from './deleteOperations';

describe('deleteOperations', () => {
  beforeEach(() => {
    deleteFileMock.mockReset();
    deleteDirMock.mockReset();
  });

  it('prunes deleted note metadata and returns the next tab to open', async () => {
    const result = await deleteNoteImpl('vault', 'docs/alpha.md', {
      openTabs: [
        { path: 'docs/alpha.md', name: 'alpha', isDirty: true },
        { path: 'docs/beta.md', name: 'beta', isDirty: false },
      ],
      starredEntries: [],
      currentNote: { path: 'docs/alpha.md', content: '# Alpha' },
      rootFolder: null,
      noteMetadata: {
        version: 1,
        notes: {
          'docs/alpha.md': { updatedAt: 1 },
          'docs/beta.md': { updatedAt: 2 },
        },
      },
    });

    expect(deleteFileMock).toHaveBeenCalledWith('vault/docs/alpha.md');
    expect(result.updatedTabs).toEqual([{ path: 'docs/beta.md', name: 'beta', isDirty: false }]);
    expect(result.nextAction).toEqual({ type: 'open', path: 'docs/beta.md' });
    expect(result.updatedMetadata).toEqual({
      version: 1,
      notes: {
        'docs/beta.md': { updatedAt: 2 },
      },
    });
  });

  it('prunes deleted folder metadata subtree and returns the next tab to open', async () => {
    const result = await deleteFolderImpl('vault', 'docs', {
      openTabs: [
        { path: 'docs/alpha.md', name: 'alpha', isDirty: false },
        { path: 'archive/gamma.md', name: 'gamma', isDirty: false },
      ],
      starredEntries: [],
      currentNote: { path: 'docs/alpha.md', content: '# Alpha' },
      rootFolder: null,
      noteMetadata: {
        version: 1,
        notes: {
          'docs/alpha.md': { updatedAt: 1 },
          'docs/nested/beta.md': { updatedAt: 2 },
          'archive/gamma.md': { updatedAt: 3 },
        },
      },
    });

    expect(deleteDirMock).toHaveBeenCalledWith('vault/docs', true);
    expect(result.updatedTabs).toEqual([{ path: 'archive/gamma.md', name: 'gamma', isDirty: false }]);
    expect(result.nextAction).toEqual({ type: 'open', path: 'archive/gamma.md' });
    expect(result.updatedMetadata).toEqual({
      version: 1,
      notes: {
        'archive/gamma.md': { updatedAt: 3 },
      },
    });
  });
});
