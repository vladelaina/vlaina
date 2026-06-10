import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createStore } from 'zustand/vanilla';
import { createFeatureSlice } from './featureSlice';
import type { NotesStore } from '../types';

const mocks = vi.hoisted(() => ({
  readFile: vi.fn(),
  safeWriteTextFile: vi.fn(),
  stat: vi.fn(),
}));

vi.mock('@/lib/storage/adapter', async () => {
  const actual = await vi.importActual<typeof import('@/lib/storage/adapter')>('@/lib/storage/adapter');
  return {
    ...actual,
    getStorageAdapter: () => ({
      readFile: mocks.readFile,
      stat: mocks.stat,
    }),
  };
});

vi.mock('../storage', async () => {
  const actual = await vi.importActual<typeof import('../storage')>('../storage');
  return {
    ...actual,
    safeWriteTextFile: mocks.safeWriteTextFile,
  };
});

function createNotesStore(overrides: Partial<NotesStore> = {}) {
  const baseState = {
    rootFolder: {
      id: '',
      name: 'Notes',
      path: '',
      isFolder: true,
      expanded: true,
      children: [],
    },
    rootFolderPath: '/vault',
    currentNote: null,
    currentNoteRevision: 0,
    currentNoteDiskRevision: 0,
    notesPath: '/vault',
    isDirty: false,
    isLoading: false,
    error: null,
    recentNotes: [],
    openTabs: [],
    recentlyClosedTabs: [],
    noteContentsCache: new Map(),
    noteContentsCacheRevision: 0,
    draftNotes: {},
    starredEntries: [],
    starredNotes: [],
    starredFolders: [],
    starredLoaded: true,
    pendingStarredNavigation: null,
    noteMetadata: { version: 2, notes: {} },
    noteIconSize: 60,
    displayNames: new Map(),
    isNewlyCreated: false,
    pendingDraftDiscardPath: null,
    pendingDeletedItems: [],
    newlyCreatedFolderPath: null,
    assetList: [],
    isLoadingAssets: false,
    uploadProgress: null,
    fileTreeSortMode: 'name-asc' as const,
    saveNote: vi.fn(async () => undefined),
  };

  return createStore<NotesStore>()((set, get, api) => ({
    ...(baseState as unknown as NotesStore),
    ...(createFeatureSlice(set, get, api) as unknown as NotesStore),
    ...(overrides as NotesStore),
  }));
}

describe('featureSlice internal note paths', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.stat.mockResolvedValue({ modifiedAt: 2, isFile: true, size: 16 });
    mocks.readFile.mockImplementation(async (path: string) => `# ${path}`);
    mocks.safeWriteTextFile.mockResolvedValue(undefined);
  });

  it('skips internal folders and files during full-vault scans but keeps user dot notes', async () => {
    const store = createNotesStore({
      rootFolder: {
        id: '',
        name: 'Notes',
        path: '',
        isFolder: true,
        expanded: true,
        children: [
          { id: '.journal.md', name: '.journal.md', path: '.journal.md', isFolder: false },
          {
            id: '.notes',
            name: '.notes',
            path: '.notes',
            isFolder: true,
            expanded: true,
            children: [
              { id: '.notes/alpha.md', name: 'alpha.md', path: '.notes/alpha.md', isFolder: false },
            ],
          },
          {
            id: '.vlaina',
            name: '.vlaina',
            path: '.vlaina',
            isFolder: true,
            expanded: true,
            children: [
              { id: '.vlaina/workspace.md', name: 'workspace.md', path: '.vlaina/workspace.md', isFolder: false },
            ],
          },
          {
            id: '.VLAINA',
            name: '.VLAINA',
            path: '.VLAINA',
            isFolder: true,
            expanded: true,
            children: [
              { id: '.VLAINA/workspace.md', name: 'workspace.md', path: '.VLAINA/workspace.md', isFolder: false },
            ],
          },
          {
            id: 'docs',
            name: 'docs',
            path: 'docs',
            isFolder: true,
            expanded: true,
            children: [
              { id: 'docs/.git/config.md', name: 'config.md', path: 'docs/.git/config.md', isFolder: false },
              { id: 'docs/.GIT/config.md', name: 'config.md', path: 'docs/.GIT/config.md', isFolder: false },
            ],
          },
        ],
      },
    });

    await store.getState().scanAllNotes();

    expect(mocks.readFile).toHaveBeenCalledWith('/vault/.journal.md');
    expect(mocks.readFile).toHaveBeenCalledWith('/vault/.notes/alpha.md');
    expect(mocks.readFile).not.toHaveBeenCalledWith('/vault/.vlaina/workspace.md');
    expect(mocks.readFile).not.toHaveBeenCalledWith('/vault/docs/.git/config.md');
    expect(mocks.readFile).not.toHaveBeenCalledWith('/vault/.VLAINA/workspace.md');
    expect(mocks.readFile).not.toHaveBeenCalledWith('/vault/docs/.GIT/config.md');
    expect(store.getState().noteContentsCache.has('.journal.md')).toBe(true);
    expect(store.getState().noteContentsCache.has('.notes/alpha.md')).toBe(true);
    expect(store.getState().noteContentsCache.has('.vlaina/workspace.md')).toBe(false);
    expect(store.getState().noteContentsCache.has('docs/.git/config.md')).toBe(false);
    expect(store.getState().noteContentsCache.has('.VLAINA/workspace.md')).toBe(false);
    expect(store.getState().noteContentsCache.has('docs/.GIT/config.md')).toBe(false);
  });

  it('does not read or write internal paths during metadata updates', () => {
    const store = createNotesStore();

    store.getState().setNoteIcon('docs/.git/config.md', 'sparkles');
    store.getState().setNoteIcon('docs/.GIT/config.md', 'sparkles');

    expect(store.getState().error).toBe('Path must not be inside an internal notes folder.');
    expect(mocks.stat).not.toHaveBeenCalled();
    expect(mocks.readFile).not.toHaveBeenCalled();
    expect(mocks.safeWriteTextFile).not.toHaveBeenCalled();
    expect(store.getState().noteMetadata?.notes['docs/.git/config.md']).toBeUndefined();
    expect(store.getState().noteMetadata?.notes['docs/.GIT/config.md']).toBeUndefined();
  });

  it('does not read or write non-markdown paths during metadata updates', () => {
    const store = createNotesStore();

    store.getState().setNoteIcon('docs/image.png', 'sparkles');

    expect(store.getState().error).toBe('Only Markdown files can be opened as notes.');
    expect(mocks.stat).not.toHaveBeenCalled();
    expect(mocks.readFile).not.toHaveBeenCalled();
    expect(mocks.safeWriteTextFile).not.toHaveBeenCalled();
    expect(store.getState().noteMetadata?.notes['docs/image.png']).toBeUndefined();
  });

  it('does not read, write, or cache metadata for unsafe note paths', () => {
    const store = createNotesStore({
      noteContentsCache: new Map([
        ['../secret.md', { content: '# Secret', modifiedAt: 1 }],
        ['docs/secret\u202Egnp.md', { content: '# Secret', modifiedAt: 1 }],
      ]),
    });

    store.getState().setNoteIcon('../secret.md', 'sparkles');

    expect(store.getState().error).toBe('Path must stay inside the current vault.');
    expect(mocks.stat).not.toHaveBeenCalled();
    expect(mocks.readFile).not.toHaveBeenCalled();
    expect(mocks.safeWriteTextFile).not.toHaveBeenCalled();
    expect(store.getState().noteMetadata?.notes['../secret.md']).toBeUndefined();

    store.getState().setNoteIcon('docs/secret\u202Egnp.md', 'sparkles');

    expect(store.getState().error).toBe('Selected file path contains unsupported characters');
    expect(mocks.stat).not.toHaveBeenCalled();
    expect(mocks.readFile).not.toHaveBeenCalled();
    expect(mocks.safeWriteTextFile).not.toHaveBeenCalled();
    expect(store.getState().noteMetadata?.notes['docs/secret\u202Egnp.md']).toBeUndefined();
  });

  it('ignores stale internal cache entries for backlinks and tags', () => {
    const store = createNotesStore({
      noteContentsCache: new Map([
        ['docs/ref.md', { content: 'See [[Alpha]] #public', modifiedAt: 1 }],
        ['.vlaina/secret.md', { content: 'See [[Alpha]] #secret', modifiedAt: 1 }],
        ['docs/.git/config.md', { content: 'See [[Alpha]] #git', modifiedAt: 1 }],
        ['.VLAINA/secret.md', { content: 'See [[Alpha]] #secretUpper', modifiedAt: 1 }],
        ['docs/.GIT/config.md', { content: 'See [[Alpha]] #gitUpper', modifiedAt: 1 }],
      ]),
    });

    expect(store.getState().getBacklinks('alpha.md')).toEqual([
      {
        path: 'docs/ref.md',
        name: 'ref',
        context: 'See [[Alpha]] #public',
      },
    ]);
    expect(store.getState().getBacklinks('.vlaina/secret.md')).toEqual([]);
    expect(store.getState().getAllTags()).toEqual([
      { tag: 'public', count: 1 },
    ]);
  });

  it('ignores stale unsafe cache entries for backlinks and tags', () => {
    const store = createNotesStore({
      noteContentsCache: new Map([
        ['docs/ref.md', { content: 'See [[Alpha]] #public', modifiedAt: 1 }],
        ['../secret.md', { content: 'See [[Alpha]] #secret', modifiedAt: 1 }],
        ['docs/secret\u202Egnp.md', { content: 'See [[Alpha]] #bidi', modifiedAt: 1 }],
      ]),
    });

    expect(store.getState().getBacklinks('alpha.md')).toEqual([
      {
        path: 'docs/ref.md',
        name: 'ref',
        context: 'See [[Alpha]] #public',
      },
    ]);
    expect(store.getState().getAllTags()).toEqual([
      { tag: 'public', count: 1 },
    ]);
  });

  it('ignores hidden markdown content when collecting backlinks', () => {
    const store = createNotesStore({
      noteContentsCache: new Map([
        ['docs/code.md', { content: '```md\n[[Alpha]]\n```', modifiedAt: 1 }],
        ['docs/inline-code.md', { content: 'Use `[[Alpha]]` as text', modifiedAt: 1 }],
        ['docs/link-target.md', { content: '[hidden](docs/[[Alpha]].md)', modifiedAt: 1 }],
        ['docs/html.md', { content: '<img alt="[[Alpha]]" src="photo.png">', modifiedAt: 1 }],
        ['docs/frontmatter.md', { content: '---\nrelated: [[Alpha]]\n---\nBody', modifiedAt: 1 }],
        ['docs/ref.md', { content: 'See [[Alpha|the alpha note]] here', modifiedAt: 1 }],
      ]),
    });

    expect(store.getState().getBacklinks('alpha.md')).toEqual([
      {
        path: 'docs/ref.md',
        name: 'ref',
        context: 'See [[Alpha|the alpha note]] here',
      },
    ]);
  });
});
