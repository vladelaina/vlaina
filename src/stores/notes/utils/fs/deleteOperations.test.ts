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
    hoisted.deleteNoteItemToRecoverableLocation.mockResolvedValue(undefined);
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
      '/vault/docs/remove.md',
      'file'
    );
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
      '/vault/docs',
      'folder'
    );
  });
});
