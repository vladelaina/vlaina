import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FolderNode, NoteFile } from '../../types';
import { deleteFolderImpl, deleteNoteImpl } from './deleteOperations';

const hoisted = vi.hoisted(() => ({
  deleteNoteItemToPendingTrash: vi.fn(),
  markExpectedExternalChange: vi.fn(),
  saveStarredRegistry: vi.fn(),
}));

vi.mock('./trashOperations', () => ({
  deleteNoteItemToPendingTrash: hoisted.deleteNoteItemToPendingTrash,
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
    hoisted.deleteNoteItemToPendingTrash.mockResolvedValue({
      id: 'delete-1',
      kind: 'file',
      originalPath: 'docs/remove.md',
      originalFullPath: '/notesRoot/docs/remove.md',
      stagingPath: '/app/.vlaina/notes/notes-roots/notes-root-test/trash/delete-1/remove.md',
      deletedAt: 1,
    });
  });

  it('moves deleted notes through the pending trash helper', async () => {
    await deleteNoteImpl('/notesRoot', 'docs/remove.md', {
      rootFolder: createFolder('', [createFolder('docs', [createFile('docs/remove.md')])]),
      currentNote: null,
      openTabs: [],
      starredEntries: [],
      noteMetadata: null,
    });

    expect(hoisted.markExpectedExternalChange).toHaveBeenCalledWith('/notesRoot/docs/remove.md');
    expect(hoisted.deleteNoteItemToPendingTrash).toHaveBeenCalledWith(
      '/notesRoot',
      'docs/remove.md',
      'file'
    );
  });

  it('rejects note delete paths that escape the notesRoot', async () => {
    await expect(deleteNoteImpl('/notesRoot', '../secret.md', {
      rootFolder: null,
      currentNote: null,
      openTabs: [],
      starredEntries: [],
      noteMetadata: null,
    })).rejects.toThrow('Path must stay inside the opened folder.');

    expect(hoisted.deleteNoteItemToPendingTrash).not.toHaveBeenCalled();
  });

  it('rejects note delete paths inside internal folders', async () => {
    await expect(deleteNoteImpl('/notesRoot', 'docs/.git/config.md', {
      rootFolder: null,
      currentNote: null,
      openTabs: [],
      starredEntries: [],
      noteMetadata: null,
    })).rejects.toThrow('Path must not be inside an internal notes folder.');
    await expect(deleteNoteImpl('/notesRoot', 'docs/.GIT/config.md', {
      rootFolder: null,
      currentNote: null,
      openTabs: [],
      starredEntries: [],
      noteMetadata: null,
    })).rejects.toThrow('Path must not be inside an internal notes folder.');

    expect(hoisted.markExpectedExternalChange).not.toHaveBeenCalled();
    expect(hoisted.deleteNoteItemToPendingTrash).not.toHaveBeenCalled();
  });

  it('does not auto-open an adjacent file when deleting the current note with no remaining tabs', async () => {
    const result = await deleteNoteImpl('/notesRoot', 'docs/remove.md', {
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
    const result = await deleteNoteImpl('/notesRoot', 'docs/remove.md', {
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

  it('moves deleted folders through the pending trash helper', async () => {
    await deleteFolderImpl('/notesRoot', 'docs', {
      rootFolder: createFolder('', [createFolder('docs', [createFile('docs/remove.md')])]),
      currentNote: null,
      openTabs: [],
      starredEntries: [],
      noteMetadata: null,
    });

    expect(hoisted.markExpectedExternalChange).toHaveBeenCalledWith('/notesRoot/docs', true);
    expect(hoisted.deleteNoteItemToPendingTrash).toHaveBeenCalledWith(
      '/notesRoot',
      'docs',
      'folder'
    );
  });

  it('rejects folder delete paths that escape the notesRoot', async () => {
    await expect(deleteFolderImpl('/notesRoot', '../docs', {
      rootFolder: null,
      currentNote: null,
      openTabs: [],
      starredEntries: [],
      noteMetadata: null,
    })).rejects.toThrow('Path must stay inside the opened folder.');

    expect(hoisted.deleteNoteItemToPendingTrash).not.toHaveBeenCalled();
  });

  it('rejects folder delete paths inside internal folders', async () => {
    await expect(deleteFolderImpl('/notesRoot', '.vlaina', {
      rootFolder: null,
      currentNote: null,
      openTabs: [],
      starredEntries: [],
      noteMetadata: null,
    })).rejects.toThrow('Path must not be inside an internal notes folder.');
    await expect(deleteFolderImpl('/notesRoot', '.VLAINA', {
      rootFolder: null,
      currentNote: null,
      openTabs: [],
      starredEntries: [],
      noteMetadata: null,
    })).rejects.toThrow('Path must not be inside an internal notes folder.');

    expect(hoisted.markExpectedExternalChange).not.toHaveBeenCalled();
    expect(hoisted.deleteNoteItemToPendingTrash).not.toHaveBeenCalled();
  });

  it('does not auto-open an adjacent file when deleting the folder that contains the current note', async () => {
    hoisted.deleteNoteItemToPendingTrash.mockResolvedValueOnce({
      id: 'delete-1',
      kind: 'folder',
      originalPath: 'docs',
      originalFullPath: '/notesRoot/docs',
      stagingPath: '/app/.vlaina/notes/notes-roots/notes-root-test/trash/delete-1/docs',
      deletedAt: 1,
    });

    const result = await deleteFolderImpl('/notesRoot', 'docs', {
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
