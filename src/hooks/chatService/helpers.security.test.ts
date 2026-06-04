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
  isAbsolutePath: (path: string) =>
    path.startsWith('/') ||
    /^\\\\[^\\]+\\[^\\]+/.test(path) ||
    /^[A-Za-z]:[\\/]/.test(path),
  joinPath: async (...segments: string[]) => {
    const filtered = segments.filter(Boolean);
    if (filtered.length === 0) {
      return '';
    }
    return filtered
      .map((segment, index) => {
        if (index > 0) {
          return segment.replace(/^[/\\]+/, '');
        }
        return segment.replace(/[/\\]+$/, '');
      })
      .join('/');
  },
  normalizeAbsolutePath: (path: string) => {
    const normalized = path.replace(/\\/g, '/');
    const uncMatch = normalized.match(/^(\/\/[^/]+\/[^/]+)(?:\/|$)/);
    const root = uncMatch?.[1] ?? (/^[A-Za-z]:\//.test(normalized) ? normalized.slice(0, 3) : normalized.startsWith('/') ? '/' : '');
    if (!root) {
      return path;
    }
    const rest = normalized.slice(root.length).replace(/^\/+/, '');
    const parts: string[] = [];
    for (const part of rest.split('/')) {
      if (!part || part === '.') continue;
      if (part === '..') {
        parts.pop();
        continue;
      }
      parts.push(part);
    }
    const nextPath = parts.length > 0 ? `${root}${root.endsWith('/') ? '' : '/'}${parts.join('/')}` : root;
    return path.includes('\\') ? nextPath.replace(/\//g, '\\') : nextPath;
  },
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

  it('does not read arbitrary UNC note mentions unless they are starred', async () => {
    const notes = await loadMentionedNotes([
      { path: '\\\\server\\share\\secret.md', title: 'Secret' },
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

  it('allows UNC note mentions that match a starred external note', async () => {
    mocks.notesState.starredEntries = [{
      id: 'external-unc',
      kind: 'note',
      vaultPath: '\\\\SERVER\\Share',
      relativePath: 'Docs/Alpha.md',
      addedAt: 1,
    }];
    mocks.storage.stat.mockResolvedValue({ size: 32 });
    mocks.storage.readFile.mockResolvedValue('# Alpha');

    const notes = await loadMentionedNotes([
      { path: '\\\\server\\share\\Docs\\Alpha.md', title: 'Alpha' },
    ]);

    expect(mocks.storage.stat).toHaveBeenCalledWith('\\\\SERVER\\Share/Docs/Alpha.md');
    expect(mocks.storage.readFile).toHaveBeenCalledWith('\\\\SERVER\\Share/Docs/Alpha.md');
    expect(notes).toEqual([
      { path: '\\\\server\\share\\Docs\\Alpha.md', title: 'Alpha', content: '# Alpha' },
    ]);
  });

  it('allows UNC folder image mentions that match a starred external folder', async () => {
    mocks.notesState.starredEntries = [{
      id: 'external-folder-unc',
      kind: 'folder',
      vaultPath: '\\\\SERVER\\Share',
      relativePath: 'Assets',
      addedAt: 1,
    }];
    mocks.storage.listDir.mockResolvedValue([
      {
        name: 'cover.png',
        path: '\\\\SERVER\\Share\\Assets\\cover.png',
        isDirectory: false,
        isFile: true,
        size: 2048,
      },
    ]);

    const attachments = await loadMentionedFolderImageAttachments([
      { path: '\\\\server\\share\\Assets', title: 'Assets', kind: 'folder' },
    ]);

    expect(mocks.storage.listDir).toHaveBeenCalledWith('\\\\SERVER\\Share/Assets');
    expect(attachments).toEqual([
      {
        id: 'folder-image:\\\\SERVER\\Share/Assets/cover.png',
        path: '\\\\SERVER\\Share/Assets/cover.png',
        previewUrl: '',
        assetUrl: '',
        name: 'cover.png',
        type: 'image/png',
        size: 2048,
      },
    ]);
  });
});
