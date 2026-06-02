import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadMentionedFolderImageAttachments, loadMentionedNotes } from './helpers';

const mocks = vi.hoisted(() => ({
  flushCurrentPendingEditorMarkdown: vi.fn(),
  storage: {
    listDir: vi.fn(),
    stat: vi.fn(),
    readFile: vi.fn(),
  },
  notesState: {
    currentNote: null,
    noteContentsCache: new Map<string, { content: string }>(),
    notesPath: '/vault',
    rootFolder: null,
    starredEntries: [] as Array<{
      id: string;
      kind: 'note' | 'folder';
      vaultPath: string;
      relativePath: string;
      addedAt: number;
    }>,
    getDisplayName: vi.fn((path: string) => path),
  },
}));

vi.mock('@/stores/accountSession', () => ({
  useAccountSessionStore: {
    getState: () => ({ isConnected: false }),
  },
}));

vi.mock('@/stores/useManagedAIStore', () => ({
  useManagedAIStore: {
    getState: () => ({ refreshBudget: vi.fn() }),
  },
}));

vi.mock('@/stores/notes/useNotesStore', () => ({
  useNotesStore: {
    getState: () => mocks.notesState,
  },
}));

vi.mock('@/stores/notes/pendingEditorMarkdownFlusher', () => ({
  flushCurrentPendingEditorMarkdown: mocks.flushCurrentPendingEditorMarkdown,
}));

vi.mock('@/lib/storage/adapter', () => ({
  getStorageAdapter: () => mocks.storage,
  isAbsolutePath: (path: string) => path.startsWith('/') || /^[A-Za-z]:[\\/]/.test(path),
  joinPath: async (...segments: string[]) => segments.filter(Boolean).join('/').replace(/\/+/g, '/'),
}));

describe('chat mention path security', () => {
  beforeEach(() => {
    mocks.flushCurrentPendingEditorMarkdown.mockReset();
    mocks.storage.listDir.mockReset();
    mocks.storage.stat.mockReset();
    mocks.storage.readFile.mockReset();
    mocks.notesState.currentNote = null;
    mocks.notesState.noteContentsCache = new Map();
    mocks.notesState.notesPath = '/vault';
    mocks.notesState.rootFolder = null;
    mocks.notesState.starredEntries = [];
  });

  it('does not read relative note mentions outside the active vault', async () => {
    const notes = await loadMentionedNotes([
      { path: '../secret.md', title: 'Secret' },
    ]);

    expect(notes).toEqual([]);
    expect(mocks.storage.stat).not.toHaveBeenCalled();
    expect(mocks.storage.readFile).not.toHaveBeenCalled();
  });

  it('does not list relative folder mentions outside the active vault', async () => {
    const notes = await loadMentionedNotes([
      { path: '../secret-folder', title: 'Secret Folder', kind: 'folder' },
    ]);
    const attachments = await loadMentionedFolderImageAttachments([
      { path: '../secret-folder', title: 'Secret Folder', kind: 'folder' },
    ]);

    expect(notes).toEqual([]);
    expect(attachments).toEqual([]);
    expect(mocks.storage.listDir).not.toHaveBeenCalled();
  });

  it('does not read arbitrary absolute note mentions unless they are starred', async () => {
    const notes = await loadMentionedNotes([
      { path: '/etc/passwd.md', title: 'passwd' },
    ]);

    expect(notes).toEqual([]);
    expect(mocks.storage.stat).not.toHaveBeenCalled();
    expect(mocks.storage.readFile).not.toHaveBeenCalled();
  });

  it('allows absolute note mentions that match a starred external note', async () => {
    mocks.notesState.starredEntries = [{
      id: 'external',
      kind: 'note',
      vaultPath: '/external-vault/docs',
      relativePath: 'alpha.md',
      addedAt: 1,
    }];
    mocks.storage.stat.mockResolvedValue({ size: 32 });
    mocks.storage.readFile.mockResolvedValue('# Alpha');

    const notes = await loadMentionedNotes([
      { path: '/external-vault/docs/alpha.md', title: 'Alpha' },
    ]);

    expect(mocks.storage.stat).toHaveBeenCalledWith('/external-vault/docs/alpha.md');
    expect(mocks.storage.readFile).toHaveBeenCalledWith('/external-vault/docs/alpha.md');
    expect(notes).toEqual([
      { path: '/external-vault/docs/alpha.md', title: 'Alpha', content: '# Alpha' },
    ]);
  });
});
