import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadMentionedNotes } from './helpers';

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
    expect(mocks.storage.readFile).toHaveBeenCalledWith('/vault/docs/z-alpha.md');
  });

  it('caps folder mention directory listing scans before processing every unsupported file', async () => {
    const entries = Array.from({ length: 5000 }, (_value, index) => ({
      name: `asset-${String(index).padStart(4, '0')}.png`,
      path: `/vault/docs/asset-${String(index).padStart(4, '0')}.png`,
      isDirectory: false,
      isFile: true,
      size: 1024,
    }));
    entries.push({
      get name() {
        throw new Error('listing scan cap was not applied');
      },
      path: '/vault/docs/late.md',
      isDirectory: false,
      isFile: true,
      size: 128,
    } as never);
    mocks.storage.listDir.mockResolvedValue(entries);

    const notes = await loadMentionedNotes([
      { path: 'docs', title: 'Docs', kind: 'folder' },
    ]);

    expect(notes).toHaveLength(1);
    expect(notes[0]?.content).toContain('Directory listing:');
    expect(mocks.storage.readFile).not.toHaveBeenCalled();
  });

  it('scans user dot markdown while skipping internal and generated folders', async () => {
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
    expect(mocks.storage.listDir).not.toHaveBeenCalledWith('/vault/docs/node_modules');
    expect(mocks.storage.listDir).not.toHaveBeenCalledWith('/vault/docs/Node_Modules');
    expect(mocks.storage.listDir).not.toHaveBeenCalledWith('/vault/docs/Dist');
  });
});
