import { beforeEach, describe, expect, it, vi } from 'vitest';

const renameMock = vi.fn();

vi.mock('@/lib/storage/adapter', () => ({
  getStorageAdapter: () => ({
    rename: renameMock,
  }),
  joinPath: (...parts: string[]) => Promise.resolve(parts.join('/')),
}));

vi.mock('./pathOperations', () => ({
  resolveUniqueMovedPath: vi.fn(),
  resolveUniqueRenamedPath: vi.fn(async () => ({
    relativePath: 'docs/beta.md',
    fullPath: 'vault/docs/beta.md',
    fileName: 'beta.md',
  })),
}));

vi.mock('../../starred', () => ({
  getVaultStarredPaths: () => ({ notes: [], folders: [] }),
  remapStarredEntriesForVault: (entries: unknown[]) => ({ entries, changed: false }),
  saveStarredRegistry: vi.fn(),
}));

vi.mock('../../document/externalChangeRegistry', () => ({
  markExpectedExternalChange: vi.fn(),
}));

import { renameNoteImpl } from './renameOperations';

describe('renameOperations', () => {
  beforeEach(() => {
    renameMock.mockReset();
  });

  it('preserves custom tab titles when renaming a note', async () => {
    const result = await renameNoteImpl('vault', 'docs/alpha.md', 'beta', {
      starredEntries: [],
      noteMetadata: { version: 1, notes: {} },
      openTabs: [
        { path: 'docs/alpha.md', name: 'Custom title', isDirty: false },
        { path: 'docs/other.md', name: 'other', isDirty: false },
      ],
      rootFolder: null,
      currentNote: { path: 'docs/alpha.md', content: '# Alpha' },
    });

    expect(renameMock).toHaveBeenCalledWith('vault/docs/alpha.md', 'vault/docs/beta.md');
    expect(result?.updatedTabs).toEqual([
      { path: 'docs/beta.md', name: 'Custom title', isDirty: false },
      { path: 'docs/other.md', name: 'other', isDirty: false },
    ]);
    expect(result?.nextCurrentNote).toEqual({ path: 'docs/beta.md', content: '# Alpha' });
  });
});
