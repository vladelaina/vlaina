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
  normalizeAbsolutePath: (path: string) => {
    const normalized = path.replace(/\\/g, '/');
    const root = normalized.startsWith('/') ? '/' : /^[A-Za-z]:\//.test(normalized) ? normalized.slice(0, 3) : '';
    if (!root) return path;
    const parts: string[] = [];
    for (const part of normalized.slice(root.length).split('/')) {
      if (!part || part === '.') continue;
      if (part === '..') {
        parts.pop();
        continue;
      }
      parts.push(part);
    }
    const nextPath = `${root}${parts.join('/')}`;
    return path.includes('\\') ? nextPath.replace(/\//g, '\\') : nextPath;
  },
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

  it('does not open absolute markdown paths through the vault-relative note opener', async () => {
    const store = createNotesStore();

    await store.getState().openNote('/etc/secret.md');

    expect(storageAdapter.readFile).not.toHaveBeenCalled();
    expect(store.getState().currentNote).toBeNull();
    expect(store.getState().error).toBe('Path must stay inside the current vault.');
  });

  it('does not open relative markdown paths through the absolute note opener', async () => {
    const store = createNotesStore();

    await store.getState().openNoteByAbsolutePath('docs/alpha.md');

    expect(storageAdapter.readFile).not.toHaveBeenCalled();
    expect(store.getState().currentNote).toBeNull();
    expect(store.getState().error).toBe('Selected file path must be absolute');
  });

  it('does not read vault-relative paths that traverse outside the vault', async () => {
    const store = createNotesStore();

    await store.getState().openNote('../secret.md');

    expect(storageAdapter.readFile).not.toHaveBeenCalled();
    expect(store.getState().currentNote).toBeNull();
    expect(store.getState().error).toBe('Path must stay inside the current vault.');
  });

  it('does not open hidden app or git paths through the vault-relative note opener', async () => {
    const store = createNotesStore();

    await store.getState().openNote('.vlaina/workspace.md');

    expect(storageAdapter.readFile).not.toHaveBeenCalled();
    expect(store.getState().currentNote).toBeNull();
    expect(store.getState().error).toBe('Path must not be inside an internal notes folder.');

    await store.getState().openNote('docs/.git/config.md');

    expect(storageAdapter.readFile).not.toHaveBeenCalled();
    expect(store.getState().currentNote).toBeNull();
    expect(store.getState().error).toBe('Path must not be inside an internal notes folder.');

    await store.getState().openNote('.VLAINA/workspace.md');

    expect(storageAdapter.readFile).not.toHaveBeenCalled();
    expect(store.getState().currentNote).toBeNull();
    expect(store.getState().error).toBe('Path must not be inside an internal notes folder.');

    await store.getState().openNote('docs/.GIT/config.md');

    expect(storageAdapter.readFile).not.toHaveBeenCalled();
    expect(store.getState().currentNote).toBeNull();
    expect(store.getState().error).toBe('Path must not be inside an internal notes folder.');
  });

  it('does not open hidden app or git paths through the absolute note opener', async () => {
    const store = createNotesStore();

    await store.getState().openNoteByAbsolutePath('/vault/.vlaina/workspace.md');

    expect(storageAdapter.readFile).not.toHaveBeenCalled();
    expect(store.getState().currentNote).toBeNull();
    expect(store.getState().error).toBe('Path must not be inside an internal notes folder.');

    await store.getState().openNoteByAbsolutePath('/vault/docs/.git/config.md');

    expect(storageAdapter.readFile).not.toHaveBeenCalled();
    expect(store.getState().currentNote).toBeNull();
    expect(store.getState().error).toBe('Path must not be inside an internal notes folder.');

    await store.getState().openNoteByAbsolutePath('/vault/.VLAINA/workspace.md');

    expect(storageAdapter.readFile).not.toHaveBeenCalled();
    expect(store.getState().currentNote).toBeNull();
    expect(store.getState().error).toBe('Path must not be inside an internal notes folder.');

    await store.getState().openNoteByAbsolutePath('/vault/docs/.GIT/config.md');

    expect(storageAdapter.readFile).not.toHaveBeenCalled();
    expect(store.getState().currentNote).toBeNull();
    expect(store.getState().error).toBe('Path must not be inside an internal notes folder.');
  });

  it('does not open absolute markdown paths with unsafe path characters', async () => {
    const store = createNotesStore();

    await store.getState().openNoteByAbsolutePath('/vault/docs/secret\u202Egnp.md');

    expect(storageAdapter.readFile).not.toHaveBeenCalled();
    expect(store.getState().currentNote).toBeNull();
    expect(store.getState().error).toBe('Selected file path contains unsupported characters');

    await store.getState().openNoteByAbsolutePath('/vault/docs/secret\u001F.md');

    expect(storageAdapter.readFile).not.toHaveBeenCalled();
    expect(store.getState().currentNote).toBeNull();
    expect(store.getState().error).toBe('Selected file path contains unsupported characters');
  });

  it('opens Windows absolute markdown paths without treating the drive prefix as unsafe', async () => {
    storageAdapter.stat.mockResolvedValue({ isFile: true, modifiedAt: 1, size: 8 });
    storageAdapter.readFile.mockResolvedValue('# Alpha');
    const store = createNotesStore();

    await store.getState().openNoteByAbsolutePath('C:\\vault\\docs\\alpha.md');

    expect(storageAdapter.readFile).toHaveBeenCalledWith('C:\\vault\\docs\\alpha.md');
    expect(store.getState().currentNote).toEqual({
      path: 'C:\\vault\\docs\\alpha.md',
      content: '# Alpha',
    });
    expect(store.getState().error).toBeNull();
  });

  it('opens user dot-folder markdown through the vault-relative note opener', async () => {
    storageAdapter.stat.mockResolvedValue({ isFile: true, modifiedAt: 1, size: 8 });
    storageAdapter.readFile.mockResolvedValue('# Alpha');
    const store = createNotesStore();

    await store.getState().openNote('.notes/alpha.md');

    expect(storageAdapter.readFile).toHaveBeenCalledWith('/vault/.notes/alpha.md');
    expect(store.getState().currentNote).toEqual({
      path: '.notes/alpha.md',
      content: '# Alpha',
    });
    expect(store.getState().error).toBeNull();
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
