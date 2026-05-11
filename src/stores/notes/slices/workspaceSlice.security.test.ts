import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createStore } from 'zustand/vanilla';
import { createWorkspaceSlice } from './workspaceSlice';
import type { NotesStore } from '../types';

const storageAdapter = vi.hoisted(() => ({
  readFile: vi.fn(),
  stat: vi.fn(),
}));

vi.mock('@/lib/storage/adapter', () => ({
  getStorageAdapter: () => storageAdapter,
  isAbsolutePath: (path: string) => path.startsWith('/') || /^[A-Za-z]:[\\/]/.test(path),
  getExtension: (path: string) => {
    const name = path.replace(/\\/g, '/').split('/').pop() ?? '';
    const index = name.lastIndexOf('.');
    return index <= 0 ? '' : name.slice(index + 1);
  },
  joinPath: (...segments: string[]) => Promise.resolve(segments.join('/').replace(/\/+/g, '/')),
}));

vi.mock('../pendingEditorMarkdownFlusher', () => ({
  flushCurrentPendingEditorMarkdown: vi.fn(() => false),
}));

vi.mock('../workspacePersistence', () => ({
  persistWorkspaceSnapshot: vi.fn(),
}));

function createNotesStore() {
  return createStore<NotesStore>()((set, get, api) => ({
    ...(createWorkspaceSlice(set, get, api) as NotesStore),
    notesPath: '/vault',
    rootFolder: null,
    recentNotes: [],
    noteContentsCache: new Map(),
    displayNames: new Map(),
    starredEntries: [],
    starredNotes: [],
    starredFolders: [],
    starredLoaded: true,
    pendingStarredNavigation: null,
    noteMetadata: { version: 2, notes: {} },
    noteIconSize: 60,
    rootFolderPath: '/vault',
    fileTreeSortMode: 'name-asc',
  } as NotesStore));
}

describe('workspaceSlice security guards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storageAdapter.readFile.mockResolvedValue('# Secret');
    storageAdapter.stat.mockResolvedValue({ isFile: true, modifiedAt: 1 });
  });

  it('does not open non-Markdown absolute files as notes', async () => {
    const store = createNotesStore();

    await store.getState().openNoteByAbsolutePath('/etc/passwd');

    expect(storageAdapter.readFile).not.toHaveBeenCalled();
    expect(store.getState().currentNote).toBeNull();
    expect(store.getState().error).toBe('Only Markdown files can be opened as notes.');
  });

  it('does not read vault-relative paths that traverse outside the vault', async () => {
    const store = createNotesStore();

    await store.getState().openNote('../secret.md');

    expect(storageAdapter.readFile).not.toHaveBeenCalled();
    expect(store.getState().currentNote).toBeNull();
    expect(store.getState().error).toBe('Path must stay inside the current vault.');
  });

  it('does not read oversized markdown files into the editor', async () => {
    storageAdapter.stat.mockResolvedValue({ isFile: true, modifiedAt: 1, size: 11 * 1024 * 1024 });
    const store = createNotesStore();

    await store.getState().openNote('huge.md');

    expect(storageAdapter.readFile).not.toHaveBeenCalled();
    expect(store.getState().currentNote).toBeNull();
    expect(store.getState().error).toBe('Note file is too large to open.');
  });
});
