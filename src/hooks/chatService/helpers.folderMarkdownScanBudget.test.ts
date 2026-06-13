import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadMentionedNotes } from './helpers';

const MAX_NOTE_MENTION_READ_BYTES = 512 * 1024;

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
    rootFolder: null as any,
    starredEntries: [],
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

vi.mock('@/components/Chat/common/svgRasterize', () => ({
  isSvgDataUrl: (value: string) => value.trim().toLowerCase().startsWith('data:image/svg+xml'),
  rasterizeSvgDataUrlToPng: vi.fn(),
}));

vi.mock('@/lib/storage/adapter', () => ({
  getStorageAdapter: () => mocks.storage,
  isAbsolutePath: (path: string) => path.startsWith('/') || /^[A-Za-z]:[\\/]/.test(path),
  joinPath: async (...segments: string[]) => segments.filter(Boolean).join('/'),
  normalizeAbsolutePath: (path: string) => path.replace(/\\/g, '/'),
}));

describe('folder markdown mention scan budgets', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.notesState.currentNote = null;
    mocks.notesState.noteContentsCache = new Map();
    mocks.notesState.notesPath = '/vault';
    mocks.notesState.rootFolder = null;
    mocks.notesState.starredEntries = [];
    mocks.storage.stat.mockResolvedValue({ isFile: true, isDirectory: false, size: 128 });
    mocks.storage.readFile.mockResolvedValue('# Alpha');
  });

  it('does not spend disk scan budget on unsupported files before markdown notes', async () => {
    mocks.storage.listDir.mockImplementation(async (path: string) => {
      if (path === '/vault/docs') {
        return [
          ...Array.from({ length: 600 }, (_value, index) => ({
            name: `a-asset-${String(index).padStart(3, '0')}.png`,
            path: `/vault/docs/a-asset-${String(index).padStart(3, '0')}.png`,
            isDirectory: false,
            isFile: true,
            size: 1024,
          })),
          {
            name: 'z-alpha.md',
            path: '/vault/docs/z-alpha.md',
            isDirectory: false,
            isFile: true,
            size: 128,
          },
        ];
      }
      return [];
    });

    const notes = await loadMentionedNotes([
      { path: 'docs', title: 'Docs', kind: 'folder' },
    ]);

    expect(notes.slice(1)).toEqual([
      {
        path: 'docs/z-alpha.md',
        title: 'Docs/z-alpha',
        kind: 'note',
        content: '# Alpha',
      },
    ]);
    expect(mocks.storage.readFile).toHaveBeenCalledWith('/vault/docs/z-alpha.md', MAX_NOTE_MENTION_READ_BYTES);
  });

  it('prioritizes markdown notes before applying the folder mention listing scan cap', async () => {
    const entries = Array.from({ length: 5000 }, (_value, index) => ({
      name: `asset-${String(index).padStart(4, '0')}.png`,
      path: `/vault/docs/asset-${String(index).padStart(4, '0')}.png`,
      isDirectory: false,
      isFile: true,
      size: 1024,
    }));
    entries.push({
      name: 'late.md',
      path: '/vault/docs/late.md',
      isDirectory: false,
      isFile: true,
      size: 128,
    });
    mocks.storage.listDir.mockResolvedValue(entries);
    mocks.storage.readFile.mockResolvedValue('# Late');

    const notes = await loadMentionedNotes([
      { path: 'docs', title: 'Docs', kind: 'folder' },
    ]);

    expect(notes.slice(1)).toEqual([
      {
        path: 'docs/late.md',
        title: 'Docs/late',
        kind: 'note',
        content: '# Late',
      },
    ]);
    expect(mocks.storage.readFile).toHaveBeenCalledWith('/vault/docs/late.md', MAX_NOTE_MENTION_READ_BYTES);
  });

  it('applies the folder mention listing scan cap across nested directories', async () => {
    mocks.storage.listDir.mockImplementation(async (path: string) => {
      if (path === '/vault/docs') {
        return [
          {
            name: 'a',
            path: '/vault/docs/a',
            isDirectory: true,
            isFile: false,
          },
          {
            name: 'b',
            path: '/vault/docs/b',
            isDirectory: true,
            isFile: false,
          },
        ];
      }

      if (path === '/vault/docs/a') {
        return Array.from({ length: 4999 }, (_value, index) => ({
          name: `asset-${String(index).padStart(4, '0')}.png`,
          path: `/vault/docs/a/asset-${String(index).padStart(4, '0')}.png`,
          isDirectory: false,
          isFile: true,
          size: 1024,
        }));
      }

      if (path === '/vault/docs/b') {
        return [
          {
            name: 'late.md',
            path: '/vault/docs/b/late.md',
            isDirectory: false,
            isFile: true,
            size: 128,
          },
        ];
      }

      return [];
    });

    const notes = await loadMentionedNotes([
      { path: 'docs', title: 'Docs', kind: 'folder' },
    ]);

    expect(notes.slice(1)).toEqual([]);
    expect(mocks.storage.listDir).not.toHaveBeenCalledWith('/vault/docs/b', { includeHidden: true });
    expect(mocks.storage.readFile).not.toHaveBeenCalledWith('/vault/docs/b/late.md', MAX_NOTE_MENTION_READ_BYTES);
  });

  it('does not spend folder mention scan budget on sibling folders before markdown notes', async () => {
    mocks.storage.listDir.mockImplementation(async (path: string) => {
      if (path === '/vault/docs') {
        return [
          ...Array.from({ length: 500 }, (_value, index) => ({
            name: `folder-${String(index).padStart(3, '0')}`,
            path: `/vault/docs/folder-${String(index).padStart(3, '0')}`,
            isDirectory: true,
            isFile: false,
          })),
          {
            name: 'z-late.md',
            path: '/vault/docs/z-late.md',
            isDirectory: false,
            isFile: true,
            size: 128,
          },
        ];
      }
      return [];
    });
    mocks.storage.readFile.mockResolvedValue('# Late');

    const notes = await loadMentionedNotes([
      { path: 'docs', title: 'Docs', kind: 'folder' },
    ]);

    expect(notes.slice(1)).toEqual([
      {
        path: 'docs/z-late.md',
        title: 'Docs/z-late',
        kind: 'note',
        content: '# Late',
      },
    ]);
    expect(mocks.storage.readFile).toHaveBeenCalledWith('/vault/docs/z-late.md', MAX_NOTE_MENTION_READ_BYTES);
  });

  it('does not spend folder mention note output slots on oversized disk markdown candidates', async () => {
    mocks.storage.listDir.mockImplementation(async (path: string) => {
      if (path === '/vault/docs') {
        return [
          ...Array.from({ length: 20 }, (_value, index) => ({
            name: `bad-${String(index).padStart(2, '0')}.md`,
            path: `/vault/docs/bad-${String(index).padStart(2, '0')}.md`,
            isDirectory: false,
            isFile: true,
            size: MAX_NOTE_MENTION_READ_BYTES + 1,
          })),
          {
            name: 'valid.md',
            path: '/vault/docs/valid.md',
            isDirectory: false,
            isFile: true,
            size: 128,
          },
        ];
      }
      return [];
    });
    mocks.storage.stat.mockImplementation(async (path: string) => (
      path.includes('/bad-')
        ? { isFile: true, isDirectory: false, size: MAX_NOTE_MENTION_READ_BYTES + 1 }
        : { isFile: true, isDirectory: false, size: 128 }
    ));
    mocks.storage.readFile.mockImplementation(async (path: string) => {
      if (path === '/vault/docs/valid.md') return '# Valid';
      throw new Error(`Unexpected read: ${path}`);
    });

    const notes = await loadMentionedNotes([
      { path: 'docs', title: 'Docs', kind: 'folder' },
    ]);

    expect(notes.slice(1)).toEqual([
      {
        path: 'docs/valid.md',
        title: 'Docs/valid',
        kind: 'note',
        content: '# Valid',
      },
    ]);
    expect(mocks.storage.readFile.mock.calls.some(([path]) => String(path).includes('/bad-'))).toBe(false);
  });

  it('does not spend file tree folder mention note slots on oversized markdown candidates', async () => {
    mocks.notesState.rootFolder = {
      id: '',
      name: 'Notes',
      path: '',
      isFolder: true,
      expanded: true,
      children: [{
        id: 'docs',
        name: 'docs',
        path: 'docs',
        isFolder: true,
        expanded: true,
        children: [
          ...Array.from({ length: 20 }, (_value, index) => ({
            id: `docs/bad-${String(index).padStart(2, '0')}.md`,
            name: `bad-${String(index).padStart(2, '0')}.md`,
            path: `docs/bad-${String(index).padStart(2, '0')}.md`,
            isFolder: false as const,
          })),
          {
            id: 'docs/valid.md',
            name: 'valid.md',
            path: 'docs/valid.md',
            isFolder: false as const,
          },
        ],
      }],
    };
    mocks.notesState.getDisplayName = vi.fn((path: string) => path.split('/').pop() ?? path);
    mocks.storage.listDir.mockResolvedValue([]);
    mocks.storage.stat.mockImplementation(async (path: string) => (
      path.includes('/bad-')
        ? { isFile: true, isDirectory: false, size: MAX_NOTE_MENTION_READ_BYTES + 1 }
        : { isFile: true, isDirectory: false, size: 128 }
    ));
    mocks.storage.readFile.mockImplementation(async (path: string) => {
      if (path === '/vault/docs/valid.md') return '# Valid';
      throw new Error(`Unexpected read: ${path}`);
    });

    const notes = await loadMentionedNotes([
      { path: 'docs', title: 'Docs', kind: 'folder' },
    ]);

    expect(notes.slice(1)).toEqual([
      {
        path: 'docs/valid.md',
        title: 'Docs/valid.md',
        kind: 'note',
        content: '# Valid',
      },
    ]);
    expect(mocks.storage.readFile.mock.calls.some(([path]) => String(path).includes('/bad-'))).toBe(false);
  });

  it('scans user dot markdown and low-priority generated folders while skipping internal folders', async () => {
    mocks.storage.listDir.mockImplementation(async (path: string) => {
      if (path === '/vault/docs') {
        return [
          {
            name: '.journal.md',
            path: '/vault/docs/.journal.md',
            isDirectory: false,
            isFile: true,
            size: 128,
          },
          {
            name: '.notes',
            path: '/vault/docs/.notes',
            isDirectory: true,
            isFile: false,
          },
          {
            name: '.vlaina',
            path: '/vault/docs/.vlaina',
            isDirectory: true,
            isFile: false,
          },
          {
            name: '.git',
            path: '/vault/docs/.git',
            isDirectory: true,
            isFile: false,
          },
          {
            name: '.VLAINA',
            path: '/vault/docs/.VLAINA',
            isDirectory: true,
            isFile: false,
          },
          {
            name: '.GIT',
            path: '/vault/docs/.GIT',
            isDirectory: true,
            isFile: false,
          },
          {
            name: 'node_modules',
            path: '/vault/docs/node_modules',
            isDirectory: true,
            isFile: false,
          },
          {
            name: 'Node_Modules',
            path: '/vault/docs/Node_Modules',
            isDirectory: true,
            isFile: false,
          },
          {
            name: 'Dist',
            path: '/vault/docs/Dist',
            isDirectory: true,
            isFile: false,
          },
        ];
      }

      if (path === '/vault/docs/.notes') {
        return [
          {
            name: 'alpha.md',
            path: '/vault/docs/.notes/alpha.md',
            isDirectory: false,
            isFile: true,
            size: 128,
          },
        ];
      }

      return [
        {
          name: 'internal.md',
          path: `${path}/internal.md`,
          isDirectory: false,
          isFile: true,
          size: 128,
        },
      ];
    });
    mocks.storage.readFile.mockImplementation(async (path: string) => {
      if (path === '/vault/docs/.journal.md') return '# Journal';
      if (path === '/vault/docs/.notes/alpha.md') return '# Alpha';
      return '# Internal';
    });

    const notes = await loadMentionedNotes([
      { path: 'docs', title: 'Docs', kind: 'folder' },
    ]);

    expect(notes.slice(1)).toEqual([
      {
        path: 'docs/.journal.md',
        title: 'Docs/.journal',
        kind: 'note',
        content: '# Journal',
      },
      {
        path: 'docs/.notes/alpha.md',
        title: 'Docs/.notes/alpha',
        kind: 'note',
        content: '# Alpha',
      },
      {
        path: 'docs/Dist/internal.md',
        title: 'Docs/Dist/internal',
        kind: 'note',
        content: '# Internal',
      },
      {
        path: 'docs/node_modules/internal.md',
        title: 'Docs/node_modules/internal',
        kind: 'note',
        content: '# Internal',
      },
      {
        path: 'docs/Node_Modules/internal.md',
        title: 'Docs/Node_Modules/internal',
        kind: 'note',
        content: '# Internal',
      },
    ]);
    expect(notes[0]?.content).toContain('- .notes (folder)');
    expect(notes[0]?.content).toContain('- .journal.md (file, 128 B)');
    expect(notes[0]?.content).not.toContain('- .vlaina');
    expect(notes[0]?.content).not.toContain('- .git');
    expect(notes[0]?.content).not.toContain('- .VLAINA');
    expect(notes[0]?.content).not.toContain('- .GIT');
    expect(mocks.storage.listDir).toHaveBeenCalledWith('/vault/docs', { includeHidden: true });
    expect(mocks.storage.listDir).toHaveBeenCalledWith('/vault/docs/.notes', { includeHidden: true });
    expect(mocks.storage.listDir).not.toHaveBeenCalledWith('/vault/docs/.vlaina');
    expect(mocks.storage.listDir).not.toHaveBeenCalledWith('/vault/docs/.git');
    expect(mocks.storage.listDir).not.toHaveBeenCalledWith('/vault/docs/.VLAINA');
    expect(mocks.storage.listDir).not.toHaveBeenCalledWith('/vault/docs/.GIT');
    expect(mocks.storage.listDir).toHaveBeenCalledWith('/vault/docs/node_modules', { includeHidden: true });
    expect(mocks.storage.listDir).toHaveBeenCalledWith('/vault/docs/Node_Modules', { includeHidden: true });
    expect(mocks.storage.listDir).toHaveBeenCalledWith('/vault/docs/Dist', { includeHidden: true });
  });
});
