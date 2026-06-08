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

  it('does not read hidden app or git note mentions', async () => {
    const notes = await loadMentionedNotes([
      { path: '.vlaina/workspace.md', title: 'Workspace' },
      { path: 'docs/.git/config.md', title: 'Git Config' },
      { path: '.VLAINA/workspace.md', title: 'Workspace Uppercase' },
      { path: 'docs/.GIT/config.md', title: 'Git Config Uppercase' },
    ]);

    expect(notes).toEqual([]);
    expect(mocks.storage.stat).not.toHaveBeenCalled();
    expect(mocks.storage.readFile).not.toHaveBeenCalled();
  });

  it('does not read non-markdown note mentions inside the active vault', async () => {
    const notes = await loadMentionedNotes([
      { path: 'docs/secret.txt', title: 'Secret' },
    ]);

    expect(notes).toEqual([]);
    expect(mocks.storage.stat).not.toHaveBeenCalled();
    expect(mocks.storage.readFile).not.toHaveBeenCalled();
  });

  it('allows user dot-folder note mentions', async () => {
    mocks.storage.stat.mockResolvedValue({ size: 32 });
    mocks.storage.readFile.mockResolvedValue('# Alpha');

    const notes = await loadMentionedNotes([
      { path: '.notes/alpha.md', title: 'Alpha' },
    ]);

    expect(mocks.storage.stat).toHaveBeenCalledWith('/vault/.notes/alpha.md');
    expect(mocks.storage.readFile).toHaveBeenCalledWith('/vault/.notes/alpha.md');
    expect(notes).toEqual([
      { path: '.notes/alpha.md', title: 'Alpha', content: '# Alpha' },
    ]);
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

  it('does not read stale starred absolute note mentions that are not markdown files', async () => {
    mocks.notesState.starredEntries = [{
      id: 'external-secret',
      kind: 'note',
      vaultPath: '/external/docs',
      relativePath: 'secret.txt',
      addedAt: 1,
    }];

    const notes = await loadMentionedNotes([
      { path: '/external/docs/secret.txt', title: 'Secret' },
    ]);

    expect(notes).toEqual([]);
    expect(mocks.storage.stat).not.toHaveBeenCalled();
    expect(mocks.storage.readFile).not.toHaveBeenCalled();
  });

  it('does not read starred absolute note mentions inside hidden app or git folders', async () => {
    mocks.notesState.starredEntries = [
      {
        id: 'app-note',
        kind: 'note',
        vaultPath: '/external',
        relativePath: '.vlaina/workspace.md',
        addedAt: 1,
      },
      {
        id: 'git-note',
        kind: 'note',
        vaultPath: '/external',
        relativePath: 'docs/.git/config.md',
        addedAt: 1,
      },
      {
        id: 'app-note-uppercase',
        kind: 'note',
        vaultPath: '/external',
        relativePath: '.VLAINA/workspace.md',
        addedAt: 1,
      },
      {
        id: 'git-note-uppercase',
        kind: 'note',
        vaultPath: '/external',
        relativePath: 'docs/.GIT/config.md',
        addedAt: 1,
      },
    ];

    const notes = await loadMentionedNotes([
      { path: '/external/.vlaina/workspace.md', title: 'Workspace' },
      { path: '/external/docs/.git/config.md', title: 'Git Config' },
      { path: '/external/.VLAINA/workspace.md', title: 'Workspace Uppercase' },
      { path: '/external/docs/.GIT/config.md', title: 'Git Config Uppercase' },
    ]);

    expect(notes).toEqual([]);
    expect(mocks.storage.stat).not.toHaveBeenCalled();
    expect(mocks.storage.readFile).not.toHaveBeenCalled();
  });

  it('does not read starred absolute note mentions when the starred vault root is internal', async () => {
    mocks.notesState.starredEntries = [
      {
        id: 'app-root-note',
        kind: 'note',
        vaultPath: '/external/.vlaina',
        relativePath: 'workspace.md',
        addedAt: 1,
      },
      {
        id: 'git-root-note',
        kind: 'note',
        vaultPath: '/external/docs/.git',
        relativePath: 'config.md',
        addedAt: 1,
      },
    ];

    const notes = await loadMentionedNotes([
      { path: '/external/.vlaina/workspace.md', title: 'Workspace' },
      { path: '/external/docs/.git/config.md', title: 'Git Config' },
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

  it('ignores note mention content that exceeds the read limit after stat', async () => {
    mocks.storage.stat.mockResolvedValue({ size: 32 });
    mocks.storage.readFile.mockResolvedValue('x'.repeat(512 * 1024 + 1));

    const notes = await loadMentionedNotes([
      { path: 'docs/huge.md', title: 'Huge' },
    ]);

    expect(mocks.storage.stat).toHaveBeenCalledWith('/vault/docs/huge.md');
    expect(mocks.storage.readFile).toHaveBeenCalledWith('/vault/docs/huge.md');
    expect(notes).toEqual([]);
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

  it('does not load starred folder images when the starred vault root is internal', async () => {
    mocks.notesState.starredEntries = [{
      id: 'internal-folder',
      kind: 'folder',
      vaultPath: '/external/.vlaina',
      relativePath: 'assets',
      addedAt: 1,
    }];

    const attachments = await loadMentionedFolderImageAttachments([
      { path: '/external/.vlaina/assets', title: 'Assets', kind: 'folder' },
    ]);

    expect(attachments).toEqual([]);
    expect(mocks.storage.listDir).not.toHaveBeenCalled();
  });
});
