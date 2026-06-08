import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FolderNode, NoteFile } from '../../types';
import { deleteFolderImpl, deleteNoteImpl } from './deleteOperations';

const hoisted = vi.hoisted(() => ({
  deleteNoteItemToRecoverableLocation: vi.fn(),
  markExpectedExternalChange: vi.fn(),
  saveStarredRegistry: vi.fn(),
}));

vi.mock('./trashOperations', () => ({
  deleteNoteItemToRecoverableLocation: hoisted.deleteNoteItemToRecoverableLocation,
}));

vi.mock('../../document/externalChangeRegistry', () => ({
  markExpectedExternalChange: hoisted.markExpectedExternalChange,
}));

vi.mock('../../starred', async () => {
  const actual = await vi.importActual<typeof import('../../starred')>('../../starred');
  return {
    ...actual,
    saveStarredRegistry: hoisted.saveStarredRegistry,
  };
});

vi.mock('@/lib/storage/adapter', () => ({
  isAbsolutePath: (path: string) => path.startsWith('/') || /^[A-Za-z]:[\\/]/.test(path),
  joinPath: (...segments: string[]) => Promise.resolve(segments.join('/').replace(/\/+/g, '/')),
}));

function createFile(path: string): NoteFile {
  return {
    id: path,
    path,
    name: path.split('/').pop()?.replace(/\.md$/i, '') ?? path,
    isFolder: false,
  };
}

function createFolder(path: string, children: Array<FolderNode | NoteFile>): FolderNode {
  return {
    id: path,
    path,
    name: path.split('/').pop() || 'Notes',
    isFolder: true,
    expanded: true,
    children,
  };
}

describe('deleteOperations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.deleteNoteItemToRecoverableLocation.mockResolvedValue({
      id: 'delete-1',
      kind: 'file',
      originalPath: 'docs/remove.md',
      originalFullPath: '/vault/docs/remove.md',
      trashPath: '/app/.vlaina/store/notes/vaults/vault-test/trash/delete-1/remove.md',
      deletedAt: 1,
    });
  });

  it('moves deleted notes through the recoverable delete helper', async () => {
    await deleteNoteImpl('/vault', 'docs/remove.md', {
      rootFolder: createFolder('', [createFolder('docs', [createFile('docs/remove.md')])]),
      currentNote: null,
      openTabs: [],
      starredEntries: [],
      noteMetadata: null,
    });

    expect(hoisted.markExpectedExternalChange).toHaveBeenCalledWith('/vault/docs/remove.md');
    expect(hoisted.deleteNoteItemToRecoverableLocation).toHaveBeenCalledWith(
      '/vault',
      'docs/remove.md',
      'file'
    );
  });

  it('rejects note delete paths that escape the vault', async () => {
    await expect(deleteNoteImpl('/vault', '../secret.md', {
      rootFolder: null,
      currentNote: null,
      openTabs: [],
      starredEntries: [],
      noteMetadata: null,
    })).rejects.toThrow('Path must stay inside the current vault.');

    expect(hoisted.deleteNoteItemToRecoverableLocation).not.toHaveBeenCalled();
  });

  it('rejects note delete paths inside internal folders', async () => {
    await expect(deleteNoteImpl('/vault', 'docs/.git/config.md', {
      rootFolder: null,
      currentNote: null,
      openTabs: [],
      starredEntries: [],
      noteMetadata: null,
    })).rejects.toThrow('Path must not be inside an internal notes folder.');

    expect(hoisted.markExpectedExternalChange).not.toHaveBeenCalled();
    expect(hoisted.deleteNoteItemToRecoverableLocation).not.toHaveBeenCalled();
  });

  it('does not auto-open an adjacent file when deleting the current note with no remaining tabs', async () => {
    const result = await deleteNoteImpl('/vault', 'docs/remove.md', {
      rootFolder: createFolder('', [
        createFolder('docs', [
          createFile('docs/remove.md'),
          createFile('docs/Untitled.md'),
        ]),
      ]),
      currentNote: { path: 'docs/remove.md', content: 'remove' },
      openTabs: [{ path: 'docs/remove.md', name: 'remove', isDirty: false }],
      starredEntries: [],
      noteMetadata: null,
    });

    expect(result.nextAction).toBeNull();
    expect(result.updatedTabs).toEqual([]);
  });

  it('opens the remaining tab after deleting the current note', async () => {
    const result = await deleteNoteImpl('/vault', 'docs/remove.md', {
      rootFolder: createFolder('', [
        createFolder('docs', [
          createFile('docs/remove.md'),
          createFile('docs/Untitled.md'),
        ]),
      ]),
      currentNote: { path: 'docs/remove.md', content: 'remove' },
      openTabs: [
        { path: 'docs/keep.md', name: 'keep', isDirty: false },
        { path: 'docs/remove.md', name: 'remove', isDirty: false },
      ],
      starredEntries: [],
      noteMetadata: null,
    });

    expect(result.nextAction).toEqual({ type: 'open', path: 'docs/keep.md' });
  });

  it('moves deleted folders through the recoverable delete helper', async () => {
    await deleteFolderImpl('/vault', 'docs', {
      rootFolder: createFolder('', [createFolder('docs', [createFile('docs/remove.md')])]),
      currentNote: null,
      openTabs: [],
      starredEntries: [],
      noteMetadata: null,
    });

    expect(hoisted.markExpectedExternalChange).toHaveBeenCalledWith('/vault/docs', true);
    expect(hoisted.deleteNoteItemToRecoverableLocation).toHaveBeenCalledWith(
      '/vault',
      'docs',
      'folder'
    );
  });

  it('rejects folder delete paths that escape the vault', async () => {
    await expect(deleteFolderImpl('/vault', '../docs', {
      rootFolder: null,
      currentNote: null,
      openTabs: [],
      starredEntries: [],
      noteMetadata: null,
    })).rejects.toThrow('Path must stay inside the current vault.');

    expect(hoisted.deleteNoteItemToRecoverableLocation).not.toHaveBeenCalled();
  });

  it('rejects folder delete paths inside internal folders', async () => {
    await expect(deleteFolderImpl('/vault', '.vlaina', {
      rootFolder: null,
      currentNote: null,
      openTabs: [],
      starredEntries: [],
      noteMetadata: null,
    })).rejects.toThrow('Path must not be inside an internal notes folder.');

    expect(hoisted.markExpectedExternalChange).not.toHaveBeenCalled();
    expect(hoisted.deleteNoteItemToRecoverableLocation).not.toHaveBeenCalled();
  });

  it('does not auto-open an adjacent file when deleting the folder that contains the current note', async () => {
    hoisted.deleteNoteItemToRecoverableLocation.mockResolvedValueOnce({
      id: 'delete-1',
      kind: 'folder',
      originalPath: 'docs',
      originalFullPath: '/vault/docs',
      trashPath: '/app/.vlaina/store/notes/vaults/vault-test/trash/delete-1/docs',
      deletedAt: 1,
    });

    const result = await deleteFolderImpl('/vault', 'docs', {
      rootFolder: createFolder('', [
        createFolder('docs', [createFile('docs/remove.md')]),
        createFile('Untitled.md'),
      ]),
      currentNote: { path: 'docs/remove.md', content: 'remove' },
      openTabs: [{ path: 'docs/remove.md', name: 'remove', isDirty: false }],
      starredEntries: [],
      noteMetadata: null,
    });

    expect(result.nextAction).toBeNull();
    expect(result.updatedTabs).toEqual([]);
  });
});
