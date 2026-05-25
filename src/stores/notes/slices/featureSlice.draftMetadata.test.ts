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

describe('featureSlice draft metadata', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.readFile.mockResolvedValue('');
    mocks.safeWriteTextFile.mockResolvedValue(undefined);
    mocks.stat.mockResolvedValue({ modifiedAt: 1 });
  });

  it('materializes an active draft instead of writing metadata to a draft path', async () => {
    const saveNote = vi.fn(async () => undefined);
    const store = createNotesStore({
      currentNote: { path: 'draft:blank', content: '' },
      openTabs: [{ path: 'draft:blank', name: '', isDirty: false }],
      draftNotes: {
        'draft:blank': { parentPath: null, name: '' },
      },
      noteContentsCache: new Map([['draft:blank', { content: '', modifiedAt: null }]]),
      saveNote,
    });

    store.getState().setNoteIcon('draft:blank', 'sparkles');

    await vi.waitFor(() => {
      expect(saveNote).toHaveBeenCalledWith({ explicit: false });
    });

    expect(store.getState().currentNote?.path).toBe('draft:blank');
    expect(store.getState().isDirty).toBe(true);
    expect(store.getState().openTabs).toEqual([
      { path: 'draft:blank', name: '', isDirty: true },
    ]);
    expect(store.getState().noteMetadata?.notes['draft:blank']?.icon).toBe('sparkles');
  });

  it('stores active draft metadata in memory when no vault is selected', async () => {
    const saveNote = vi.fn(async () => undefined);
    const store = createNotesStore({
      notesPath: '',
      rootFolder: null,
      currentNote: { path: 'draft:blank', content: '' },
      openTabs: [{ path: 'draft:blank', name: '', isDirty: false }],
      draftNotes: {
        'draft:blank': { parentPath: null, name: '' },
      },
      noteContentsCache: new Map([['draft:blank', { content: '', modifiedAt: null }]]),
      saveNote,
    });

    store.getState().setNoteIcon('draft:blank', 'sparkles');
    store.getState().setNoteCover('draft:blank', {
      assetPath: '@monet/1',
      positionX: 50,
      positionY: 50,
      height: 200,
      scale: 1,
    });

    await vi.waitFor(() => {
      expect(store.getState().noteMetadata?.notes['draft:blank']?.cover?.assetPath).toBe('@monet/1');
    });

    expect(saveNote).not.toHaveBeenCalled();
    expect(store.getState().noteMetadata?.notes['draft:blank']?.icon).toBe('sparkles');
    expect(store.getState().currentNote?.path).toBe('draft:blank');
    expect(store.getState().isDirty).toBe(true);
    expect(store.getState().openTabs).toEqual([
      { path: 'draft:blank', name: '', isDirty: true },
    ]);
  });

  it('keeps preserved draft metadata in memory instead of implicitly saving into the new vault', async () => {
    const saveNote = vi.fn(async () => undefined);
    const store = createNotesStore({
      notesPath: '/vault-next',
      currentNote: { path: 'draft:blank', content: '' },
      openTabs: [{ path: 'draft:blank', name: '', isDirty: false }],
      draftNotes: {
        'draft:blank': { parentPath: null, name: '', originNotesPath: '' },
      },
      noteContentsCache: new Map([['draft:blank', { content: '', modifiedAt: null }]]),
      saveNote,
    });

    store.getState().setNoteIcon('draft:blank', 'sparkles');
    store.getState().setNoteCover('draft:blank', {
      assetPath: '@monet/1',
      positionX: 50,
      positionY: 50,
      height: 200,
      scale: 1,
    });

    await vi.waitFor(() => {
      expect(store.getState().noteMetadata?.notes['draft:blank']?.cover?.assetPath).toBe('@monet/1');
    });

    expect(saveNote).not.toHaveBeenCalled();
    expect(store.getState().noteMetadata?.notes['draft:blank']?.icon).toBe('sparkles');
    expect(store.getState().currentNote?.path).toBe('draft:blank');
    expect(store.getState().isDirty).toBe(true);
    expect(store.getState().openTabs).toEqual([
      { path: 'draft:blank', name: '', isDirty: true },
    ]);
  });

  it('writes metadata for an absolute note opened without a vault', async () => {
    const store = createNotesStore({
      notesPath: '',
      rootFolder: null,
      currentNote: { path: '/notes/alpha.md', content: '# Alpha' },
      openTabs: [{ path: '/notes/alpha.md', name: 'alpha', isDirty: false }],
      noteContentsCache: new Map([['/notes/alpha.md', { content: '# Alpha', modifiedAt: 1 }]]),
    });

    store.getState().setNoteIcon('/notes/alpha.md', 'sparkles');

    await vi.waitFor(() => {
      expect(mocks.safeWriteTextFile).toHaveBeenCalled();
    });

    expect(mocks.safeWriteTextFile.mock.calls[0]?.[0]).toBe('/notes/alpha.md');
    expect(store.getState().noteMetadata?.notes['/notes/alpha.md']?.icon).toBe('sparkles');
    expect(store.getState().currentNote?.content).toContain('vlaina_icon');
    expect(store.getState().isDirty).toBe(false);
  });

  it('merges vault metadata updates with newer disk edits instead of overwriting them', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-15T10:00:00.000Z'));
    mocks.stat
      .mockResolvedValueOnce({ modifiedAt: 2 })
      .mockResolvedValueOnce({ modifiedAt: 3 });
    mocks.readFile.mockResolvedValue(['# Alpha', '', 'Disk body'].join('\n'));
    const notePath = 'docs/alpha.md';
    const store = createNotesStore({
      notesPath: '/vault',
      currentNote: { path: notePath, content: ['# Alpha', '', 'Original body'].join('\n') },
      openTabs: [{ path: notePath, name: 'alpha', isDirty: false }],
      noteContentsCache: new Map([[
        notePath,
        { content: ['# Alpha', '', 'Original body'].join('\n'), modifiedAt: 1 },
      ]]),
    });

    store.getState().setNoteIcon(notePath, 'sparkles');

    await vi.waitFor(() => {
      expect(mocks.safeWriteTextFile).toHaveBeenCalled();
    });

    const writtenContent = mocks.safeWriteTextFile.mock.calls[0]?.[1] as string;
    expect(writtenContent).toContain('vlaina_icon: "sparkles"');
    expect(writtenContent).toContain('Disk body');
    expect(writtenContent).not.toContain('Original body');
    expect(store.getState().currentNote?.content).toBe(writtenContent);
    expect(store.getState().noteContentsCache.get(notePath)).toEqual({
      content: writtenContent,
      modifiedAt: 3,
    });

    vi.useRealTimers();
  });

  it('keeps a failed absolute metadata write dirty so the change is not silently lost', async () => {
    mocks.safeWriteTextFile.mockRejectedValueOnce(new Error('disk unavailable'));
    const notePath = '/notes/alpha.md';
    const store = createNotesStore({
      notesPath: '',
      rootFolder: null,
      currentNote: { path: notePath, content: '# Alpha' },
      openTabs: [{ path: notePath, name: 'alpha', isDirty: false }],
      noteContentsCache: new Map([[notePath, { content: '# Alpha', modifiedAt: 1 }]]),
    });

    store.getState().setNoteIcon(notePath, 'sparkles');

    await vi.waitFor(() => {
      expect(store.getState().error).toBe('disk unavailable');
    });

    expect(store.getState().currentNote?.content).toContain('vlaina_icon');
    expect(store.getState().isDirty).toBe(true);
    expect(store.getState().openTabs).toEqual([
      { path: notePath, name: 'alpha', isDirty: true },
    ]);
    expect(store.getState().noteContentsCache.get(notePath)?.content).toContain('vlaina_icon');
  });

  it('keeps a failed vault metadata write dirty so the change is not silently lost', async () => {
    mocks.safeWriteTextFile.mockRejectedValueOnce(new Error('disk unavailable'));
    const notePath = 'docs/alpha.md';
    const store = createNotesStore({
      notesPath: '/vault',
      currentNote: { path: notePath, content: '# Alpha' },
      openTabs: [{ path: notePath, name: 'alpha', isDirty: false }],
      noteContentsCache: new Map([[notePath, { content: '# Alpha', modifiedAt: 1 }]]),
    });

    store.getState().setNoteCover(notePath, {
      assetPath: '@monet/1',
      positionX: 50,
      positionY: 50,
      height: 200,
      scale: 1,
    });

    await vi.waitFor(() => {
      expect(store.getState().error).toBe('disk unavailable');
    });

    expect(store.getState().currentNote?.content).toContain('vlaina_cover');
    expect(store.getState().isDirty).toBe(true);
    expect(store.getState().openTabs).toEqual([
      { path: notePath, name: 'alpha', isDirty: true },
    ]);
    expect(store.getState().noteContentsCache.get(notePath)?.content).toContain('vlaina_cover');
  });

  it('does not overwrite newer edits when absolute metadata write finishes later', async () => {
    let resolveWrite: (() => void) | undefined;
    mocks.safeWriteTextFile.mockImplementationOnce(() => new Promise<void>((resolve) => {
      resolveWrite = resolve;
    }));
    const notePath = '/notes/alpha.md';
    const store = createNotesStore({
      notesPath: '',
      rootFolder: null,
      currentNote: { path: notePath, content: '# Alpha' },
      openTabs: [{ path: notePath, name: 'alpha', isDirty: false }],
      noteContentsCache: new Map([[notePath, { content: '# Alpha', modifiedAt: 1 }]]),
    });

    store.getState().setNoteIcon(notePath, 'sparkles');

    await vi.waitFor(() => {
      expect(mocks.safeWriteTextFile).toHaveBeenCalled();
    });
    const contentWithMetadata = store.getState().currentNote?.content ?? '';
    const newerContent = `${contentWithMetadata}\n\nUser edit`;
    store.setState((state) => ({
      currentNote: { path: notePath, content: newerContent },
      currentNoteRevision: state.currentNoteRevision + 1,
      isDirty: true,
      openTabs: state.openTabs.map((tab) =>
        tab.path === notePath ? { ...tab, isDirty: true } : tab
      ),
      noteContentsCache: new Map(state.noteContentsCache).set(notePath, {
        content: newerContent,
        modifiedAt: 1,
      }),
    }));

    resolveWrite?.();

    await vi.waitFor(() => {
      expect(store.getState().noteContentsCache.get(notePath)?.modifiedAt).toBe(1);
    });
    expect(store.getState().currentNote).toEqual({ path: notePath, content: newerContent });
    expect(store.getState().isDirty).toBe(true);
    expect(store.getState().openTabs).toEqual([
      { path: notePath, name: 'alpha', isDirty: true },
    ]);
    expect(store.getState().noteContentsCache.get(notePath)).toEqual({
      content: newerContent,
      modifiedAt: 1,
    });
  });

  it('does not overwrite newer edits when vault metadata write finishes later', async () => {
    let resolveWrite: (() => void) | undefined;
    mocks.safeWriteTextFile.mockImplementationOnce(() => new Promise<void>((resolve) => {
      resolveWrite = resolve;
    }));
    const notePath = 'docs/alpha.md';
    const store = createNotesStore({
      notesPath: '/vault',
      currentNote: { path: notePath, content: '# Alpha' },
      openTabs: [{ path: notePath, name: 'alpha', isDirty: false }],
      noteContentsCache: new Map([[notePath, { content: '# Alpha', modifiedAt: 1 }]]),
    });

    store.getState().setNoteIcon(notePath, 'sparkles');

    await vi.waitFor(() => {
      expect(mocks.safeWriteTextFile).toHaveBeenCalled();
    });
    const contentWithMetadata = store.getState().currentNote?.content ?? '';
    const newerContent = `${contentWithMetadata}\n\nUser edit`;
    store.setState((state) => ({
      currentNote: { path: notePath, content: newerContent },
      currentNoteRevision: state.currentNoteRevision + 1,
      isDirty: true,
      openTabs: state.openTabs.map((tab) =>
        tab.path === notePath ? { ...tab, isDirty: true } : tab
      ),
      noteContentsCache: new Map(state.noteContentsCache).set(notePath, {
        content: newerContent,
        modifiedAt: 1,
      }),
    }));

    resolveWrite?.();

    await vi.waitFor(() => {
      expect(store.getState().noteContentsCache.get(notePath)?.modifiedAt).toBe(1);
    });
    expect(store.getState().currentNote).toEqual({ path: notePath, content: newerContent });
    expect(store.getState().isDirty).toBe(true);
    expect(store.getState().openTabs).toEqual([
      { path: notePath, name: 'alpha', isDirty: true },
    ]);
    expect(store.getState().noteContentsCache.get(notePath)).toEqual({
      content: newerContent,
      modifiedAt: 1,
    });
  });

  it('does not overwrite edits made while metadata source content is being read', async () => {
    let resolveRead: (content: string) => void;
    mocks.readFile.mockImplementationOnce(() => new Promise<string>((resolve) => {
      resolveRead = resolve;
    }));
    const notePath = 'docs/alpha.md';
    const store = createNotesStore({
      notesPath: '/vault',
      currentNote: { path: 'docs/beta.md', content: '# Beta' },
      openTabs: [{ path: 'docs/beta.md', name: 'beta', isDirty: false }],
      noteContentsCache: new Map([['docs/beta.md', { content: '# Beta', modifiedAt: 1 }]]),
    });

    store.getState().setNoteIcon(notePath, 'sparkles');

    await vi.waitFor(() => {
      expect(mocks.readFile).toHaveBeenCalled();
    });
    store.setState((state) => ({
      currentNote: { path: notePath, content: '# Local edit' },
      currentNoteRevision: state.currentNoteRevision + 1,
      isDirty: true,
      openTabs: [
        { path: 'docs/beta.md', name: 'beta', isDirty: false },
        { path: notePath, name: 'alpha', isDirty: true },
      ],
      noteContentsCache: new Map(state.noteContentsCache).set(notePath, {
        content: '# Local edit',
        modifiedAt: 1,
      }),
    }));
    resolveRead!('# Disk content');

    await vi.waitFor(() => {
      expect(store.getState().noteMetadata?.notes[notePath]?.icon).toBe('sparkles');
    });

    expect(store.getState().currentNote?.path).toBe(notePath);
    expect(store.getState().currentNote?.content).toContain('# Local edit');
    expect(store.getState().currentNote?.content).not.toContain('# Disk content');
    expect(store.getState().isDirty).toBe(true);
    expect(store.getState().openTabs).toEqual([
      { path: 'docs/beta.md', name: 'beta', isDirty: false },
      { path: notePath, name: 'alpha', isDirty: true },
    ]);
    expect(mocks.safeWriteTextFile).not.toHaveBeenCalled();
  });

  it('does not overwrite current note cache when scanAllNotes finishes after a local edit', async () => {
    let resolveRead: (content: string) => void;
    mocks.stat.mockResolvedValue({ modifiedAt: 2, isFile: true });
    mocks.readFile.mockImplementationOnce(() => new Promise<string>((resolve) => {
      resolveRead = resolve;
    }));
    const notePath = 'docs/alpha.md';
    const store = createNotesStore({
      notesPath: '/vault',
      rootFolder: {
        id: '',
        name: 'Notes',
        path: '',
        isFolder: true,
        expanded: true,
        children: [
          {
            id: 'docs',
            name: 'docs',
            path: 'docs',
            isFolder: true,
            expanded: true,
            children: [{ id: notePath, name: 'alpha', path: notePath, isFolder: false }],
          },
        ],
      },
      currentNote: { path: notePath, content: '# Old alpha' },
      openTabs: [{ path: notePath, name: 'alpha', isDirty: false }],
      noteContentsCache: new Map(),
    });

    const scan = store.getState().scanAllNotes();
    await vi.waitFor(() => {
      expect(mocks.readFile).toHaveBeenCalled();
    });
    store.setState((state) => ({
      currentNote: { path: notePath, content: '# Local edit during scan' },
      currentNoteRevision: state.currentNoteRevision + 1,
      isDirty: true,
      openTabs: state.openTabs.map((tab) =>
        tab.path === notePath ? { ...tab, isDirty: true } : tab
      ),
      noteContentsCache: new Map(state.noteContentsCache).set(notePath, {
        content: '# Local edit during scan',
        modifiedAt: 1,
      }),
    }));
    resolveRead!('# Scanned disk content');
    await scan;

    expect(store.getState().currentNote).toEqual({
      path: notePath,
      content: '# Local edit during scan',
    });
    expect(store.getState().isDirty).toBe(true);
    expect(store.getState().noteContentsCache.get(notePath)).toEqual({
      content: '# Local edit during scan',
      modifiedAt: 1,
    });
  });

  it('reuses cached note contents during full-vault scans and reads only missing notes', async () => {
    mocks.stat.mockResolvedValue({ modifiedAt: 2, isFile: true });
    mocks.readFile.mockResolvedValue('# Beta from disk');
    const alphaPath = 'docs/alpha.md';
    const betaPath = 'docs/beta.md';
    const store = createNotesStore({
      notesPath: '/vault',
      rootFolder: {
        id: '',
        name: 'Notes',
        path: '',
        isFolder: true,
        expanded: true,
        children: [
          {
            id: 'docs',
            name: 'docs',
            path: 'docs',
            isFolder: true,
            expanded: true,
            children: [
              { id: alphaPath, name: 'alpha', path: alphaPath, isFolder: false },
              { id: betaPath, name: 'beta', path: betaPath, isFolder: false },
            ],
          },
        ],
      },
      noteContentsCache: new Map([[alphaPath, { content: '# Alpha cached', modifiedAt: 1 }]]),
    });

    await store.getState().scanAllNotes();

    expect(mocks.readFile).toHaveBeenCalledTimes(1);
    expect(mocks.readFile).toHaveBeenCalledWith('/vault/docs/beta.md');
    expect(store.getState().noteContentsCache.get(alphaPath)).toEqual({
      content: '# Alpha cached',
      modifiedAt: 1,
    });
    expect(store.getState().noteContentsCache.get(betaPath)).toEqual({
      content: '# Beta from disk',
      modifiedAt: 2,
    });
  });

  it('stops full-vault scans before starting later batches after cancellation', async () => {
    mocks.stat.mockResolvedValue({ modifiedAt: 2, isFile: true });
    const pendingReads: Array<(content: string) => void> = [];
    mocks.readFile.mockImplementation(() => new Promise<string>((resolve) => {
      pendingReads.push(resolve);
    }));
    const notePaths = Array.from({ length: 12 }, (_, index) => `docs/${index}.md`);
    const store = createNotesStore({
      notesPath: '/vault',
      rootFolder: {
        id: '',
        name: 'Notes',
        path: '',
        isFolder: true,
        expanded: true,
        children: [
          {
            id: 'docs',
            name: 'docs',
            path: 'docs',
            isFolder: true,
            expanded: true,
            children: notePaths.map((path) => ({
              id: path,
              name: path.split('/').pop() ?? path,
              path,
              isFolder: false as const,
            })),
          },
        ],
      },
    });

    const scan = store.getState().scanAllNotes();
    await vi.waitFor(() => {
      expect(mocks.readFile).toHaveBeenCalledTimes(10);
    });

    store.getState().cancelNoteContentScan();
    pendingReads.forEach((resolve, index) => resolve(`# Note ${index}`));
    await scan;

    expect(mocks.readFile).toHaveBeenCalledTimes(10);
    expect(store.getState().noteContentsCache.size).toBe(0);
  });

  it('does not start a full-vault scan when its signal is already aborted', async () => {
    const abortController = new AbortController();
    abortController.abort();
    const store = createNotesStore({
      notesPath: '/vault',
      rootFolder: {
        id: '',
        name: 'Notes',
        path: '',
        isFolder: true,
        expanded: true,
        children: [{ id: 'alpha', name: 'alpha', path: 'alpha.md', isFolder: false }],
      },
    });

    await store.getState().scanAllNotes({ signal: abortController.signal });

    expect(mocks.stat).not.toHaveBeenCalled();
    expect(mocks.readFile).not.toHaveBeenCalled();
    expect(store.getState().noteContentsCache.size).toBe(0);
  });

  it('removes stale absolute-note icon and cover metadata after frontmatter deletion', async () => {
    const notePath = '/notes/alpha.md';
    const content = [
      '---',
      'vlaina_cover: "@monet/4"',
      'vlaina_cover_x: 50',
      'vlaina_cover_y: 50',
      'vlaina_cover_height: 200',
      'vlaina_cover_scale: 1',
      'vlaina_icon: "sparkles"',
      '---',
      '# Alpha',
    ].join('\n');
    const store = createNotesStore({
      notesPath: '',
      rootFolder: null,
      currentNote: { path: notePath, content },
      openTabs: [{ path: notePath, name: 'alpha', isDirty: false }],
      noteContentsCache: new Map([[notePath, { content, modifiedAt: 1 }]]),
      noteMetadata: {
        version: 2,
        notes: {
          [notePath]: {
            icon: 'sparkles',
            cover: {
              assetPath: '@monet/4',
              positionX: 50,
              positionY: 50,
              height: 200,
              scale: 1,
            },
          },
        },
      },
    });

    store.getState().setNoteIcon(notePath, null);

    await vi.waitFor(() => {
      expect(store.getState().currentNote?.content).not.toContain('vlaina_icon');
    });
    expect(store.getState().noteMetadata?.notes[notePath]?.icon).toBeUndefined();
    expect(store.getState().noteMetadata?.notes[notePath]?.cover?.assetPath).toBe('@monet/4');

    store.getState().setNoteCover(notePath, null);

    await vi.waitFor(() => {
      expect(store.getState().currentNote?.content).not.toContain('vlaina_cover');
    });
    expect(store.getState().noteMetadata?.notes[notePath]?.icon).toBeUndefined();
    expect(store.getState().noteMetadata?.notes[notePath]?.cover).toBeUndefined();
  });
});

describe('featureSlice starred path resolution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.safeWriteTextFile.mockResolvedValue(undefined);
  });

  it('matches current-vault absolute note paths against relative starred notes', () => {
    const store = createNotesStore({
      notesPath: '/vault',
      starredEntries: [
        {
          id: 'starred-alpha',
          kind: 'note',
          vaultPath: '/vault',
          relativePath: 'docs/alpha.md',
          addedAt: 1,
        },
      ],
      starredNotes: ['docs/alpha.md'],
    });

    expect(store.getState().isStarred('/vault/docs/alpha.md')).toBe(true);
    expect(store.getState().isStarred('/other/docs/alpha.md')).toBe(false);
  });

  it('matches root-vault absolute note paths against relative starred notes', () => {
    const store = createNotesStore({
      notesPath: '/',
      starredEntries: [
        {
          id: 'starred-alpha',
          kind: 'note',
          vaultPath: '/',
          relativePath: 'docs/alpha.md',
          addedAt: 1,
        },
      ],
      starredNotes: ['docs/alpha.md'],
    });

    expect(store.getState().isStarred('/docs/alpha.md')).toBe(true);
  });

  it('toggles root-vault absolute note paths as relative starred entries', () => {
    const store = createNotesStore({
      notesPath: '/',
      starredEntries: [],
      starredNotes: [],
    });

    store.getState().toggleStarred('/docs/alpha.md');

    expect(store.getState().starredEntries[0]).toMatchObject({
      kind: 'note',
      vaultPath: '/',
      relativePath: 'docs/alpha.md',
    });
    expect(store.getState().starredNotes).toEqual(['docs/alpha.md']);
  });

  it('toggles current-vault absolute note paths as relative starred entries', () => {
    const store = createNotesStore({
      notesPath: '/vault',
      starredEntries: [],
      starredNotes: [],
    });

    store.getState().toggleStarred('/vault/docs/alpha.md');

    expect(store.getState().starredEntries[0]).toMatchObject({
      kind: 'note',
      vaultPath: '/vault',
      relativePath: 'docs/alpha.md',
    });
    expect(store.getState().starredNotes).toEqual(['docs/alpha.md']);

    store.getState().toggleStarred('/vault/docs/alpha.md');

    expect(store.getState().starredEntries).toEqual([]);
    expect(store.getState().starredNotes).toEqual([]);
  });

  it('matches external absolute starred note paths from another vault', () => {
    const store = createNotesStore({
      notesPath: '/vault',
      starredEntries: [
        {
          id: 'starred-external',
          kind: 'note',
          vaultPath: '/other',
          relativePath: 'docs/alpha.md',
          addedAt: 1,
        },
      ],
      starredNotes: [],
    });

    expect(store.getState().isStarred('/other/docs/alpha.md')).toBe(true);
  });

  it('toggles an external absolute starred note path off without adding it to the current vault', () => {
    const store = createNotesStore({
      notesPath: '/vault',
      starredEntries: [
        {
          id: 'starred-external',
          kind: 'note',
          vaultPath: '/other',
          relativePath: 'docs/alpha.md',
          addedAt: 1,
        },
      ],
      starredNotes: [],
    });

    store.getState().toggleStarred('/other/docs/alpha.md');

    expect(store.getState().starredEntries).toEqual([]);
    expect(store.getState().starredNotes).toEqual([]);
  });

  it('toggles an external absolute starred note path off when no vault is open', () => {
    const store = createNotesStore({
      notesPath: '',
      starredEntries: [
        {
          id: 'starred-external',
          kind: 'note',
          vaultPath: '/other',
          relativePath: 'docs/alpha.md',
          addedAt: 1,
        },
      ],
      starredNotes: [],
    });

    expect(store.getState().isStarred('/other/docs/alpha.md')).toBe(true);

    store.getState().toggleStarred('/other/docs/alpha.md');

    expect(store.getState().starredEntries).toEqual([]);
  });

  it('creates external starred entries for absolute notes when no vault is open', () => {
    const store = createNotesStore({
      notesPath: '',
      starredEntries: [],
      starredNotes: [],
    });

    store.getState().toggleStarred('/other/docs/alpha.md');

    expect(store.getState().starredEntries[0]).toMatchObject({
      kind: 'note',
      vaultPath: '/other/docs',
      relativePath: 'alpha.md',
    });
    expect(store.getState().starredNotes).toEqual([]);
  });

  it('removes duplicate starred entries for the same external absolute note path', () => {
    const store = createNotesStore({
      notesPath: '/vault',
      starredEntries: [
        {
          id: 'starred-external-a',
          kind: 'note',
          vaultPath: '/other/docs',
          relativePath: 'alpha.md',
          addedAt: 1,
        },
        {
          id: 'starred-external-b',
          kind: 'note',
          vaultPath: '/other/docs',
          relativePath: 'alpha.md',
          addedAt: 2,
        },
      ],
      starredNotes: [],
    });

    store.getState().toggleStarred('/other/docs/alpha.md');

    expect(store.getState().starredEntries).toEqual([]);
  });

  it('creates external starred entries for absolute notes outside the current vault', () => {
    const store = createNotesStore({
      notesPath: '/vault',
      starredEntries: [],
      starredNotes: [],
    });

    store.getState().toggleStarred('/other/docs/alpha.md');

    expect(store.getState().starredEntries[0]).toMatchObject({
      kind: 'note',
      vaultPath: '/other/docs',
      relativePath: 'alpha.md',
    });
    expect(store.getState().starredNotes).toEqual([]);
  });
});
