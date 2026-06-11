import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  storage: {
    platform: 'electron' as const,
    exists: vi.fn(),
    mkdir: vi.fn(),
    rename: vi.fn(),
  },
  ensureVaultConfig: vi.fn(),
  saveAutoSaveableDrafts: vi.fn(),
  saveDirtyRegularOpenTabs: vi.fn(),
}));

vi.mock('@/lib/storage/adapter', () => ({
  getStorageAdapter: () => mocks.storage,
  isAbsolutePath: (path: string) => path.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(path),
  normalizeAbsolutePath: (path: string) => path.replace(/\\/g, '/').replace(/\/+/g, '/').replace(/\/+$/, ''),
}));

vi.mock('./vaultConfig', () => ({
  ensureVaultConfig: mocks.ensureVaultConfig,
  normalizeVaultPath: (path: string) => path.replace(/\\/g, '/'),
}));

vi.mock('@/stores/notes/dirtyOpenTabs', () => ({
  saveDirtyRegularOpenTabs: mocks.saveDirtyRegularOpenTabs,
}));

vi.mock('@/stores/notes/autoSaveableDrafts', () => ({
  saveAutoSaveableDrafts: mocks.saveAutoSaveableDrafts,
}));

import { useNotesStore } from './useNotesStore';
import { useVaultStore } from './useVaultStore';

describe('useVaultStore dirty note protection', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    mocks.storage.exists.mockResolvedValue(true);
    mocks.ensureVaultConfig.mockResolvedValue(undefined);
    mocks.saveAutoSaveableDrafts.mockResolvedValue(true);
    mocks.saveDirtyRegularOpenTabs.mockResolvedValue(true);

    useVaultStore.setState({
      currentVault: {
        id: 'vault-old',
        name: 'old',
        path: '/vault/old',
        lastOpened: 1,
      },
      recentVaults: [
        {
          id: 'vault-old',
          name: 'old',
          path: '/vault/old',
          lastOpened: 1,
        },
      ],
      isLoading: false,
      hasInitialized: true,
      error: null,
    });

    useNotesStore.setState({
      notesPath: '/vault/old',
      currentNote: { path: 'current.md', content: 'Current' },
      isDirty: false,
      openTabs: [{ path: 'current.md', name: 'current', isDirty: false }],
      rootFolder: null,
      rootFolderPath: null,
      noteContentsCache: new Map(),
      draftNotes: {},
      starredEntries: [],
      starredNotes: [],
      starredFolders: [],
      noteMetadata: { version: 1, notes: {} },
    });
  });

  it('saves dirty regular tabs before opening another vault', async () => {
    const opened = await useVaultStore.getState().openVault('/vault/next');

    expect(opened).toBe(true);
    expect(mocks.saveAutoSaveableDrafts).toHaveBeenCalledTimes(1);
    expect(mocks.saveDirtyRegularOpenTabs).toHaveBeenCalledTimes(1);
    expect(useVaultStore.getState().currentVault).toMatchObject({
      name: 'next',
      path: '/vault/next',
    });
    expect(useNotesStore.getState().notesPath).toBe('/vault/next');
  });

  it('clears note workspace state before switching to another vault', async () => {
    useNotesStore.setState({
      rootFolder: {
        id: '',
        name: 'Notes',
        path: '',
        isFolder: true,
        expanded: true,
        children: [{ id: 'current.md', name: 'current', path: 'current.md', isFolder: false }],
      },
      rootFolderPath: '/vault/old',
      recentlyClosedTabs: [{ tab: { path: 'old.md', name: 'old', isDirty: false }, index: 0 }],
      noteContentsCache: new Map([['current.md', { content: 'Current', modifiedAt: null }]]),
      displayNames: new Map([['current.md', 'current']]),
    });

    const opened = await useVaultStore.getState().openVault('/vault/next');

    expect(opened).toBe(true);
    expect(useNotesStore.getState()).toMatchObject({
      notesPath: '/vault/next',
      currentNote: null,
      isDirty: false,
      openTabs: [],
      recentlyClosedTabs: [],
      rootFolder: expect.objectContaining({
        children: [{ id: 'current.md', name: 'current', path: 'current.md', isFolder: false }],
      }),
      rootFolderPath: '/vault/old',
      draftNotes: {},
    });
    expect(useNotesStore.getState().noteContentsCache.size).toBe(0);
    expect(useNotesStore.getState().displayNames.size).toBe(0);
  });

  it('keeps a placeholder sidebar root while switching from a blank workspace', async () => {
    useNotesStore.setState({
      notesPath: '',
      currentNote: null,
      isDirty: false,
      openTabs: [],
      rootFolder: null,
      rootFolderPath: null,
    });
    useVaultStore.setState({
      currentVault: null,
      recentVaults: [],
    });

    const opened = await useVaultStore.getState().openVault('/vault/next');

    expect(opened).toBe(true);
    expect(useNotesStore.getState()).toMatchObject({
      notesPath: '/vault/next',
      rootFolder: expect.objectContaining({
        id: '',
        name: 'Notes',
        path: '',
        isFolder: true,
        expanded: true,
        children: [],
      }),
      rootFolderPath: null,
    });
  });

  it('can skip the placeholder sidebar root for direct markdown navigation', async () => {
    useNotesStore.setState({
      notesPath: '',
      currentNote: null,
      isDirty: false,
      openTabs: [],
      rootFolder: null,
      rootFolderPath: null,
    });
    useVaultStore.setState({
      currentVault: null,
      recentVaults: [],
    });

    const opened = await useVaultStore.getState().openVault('/vault/next', undefined, {
      preserveSidebarTree: false,
    });

    expect(opened).toBe(true);
    expect(useNotesStore.getState()).toMatchObject({
      notesPath: '/vault/next',
      rootFolder: null,
      rootFolderPath: null,
    });
  });

  it('does not open another vault if dirty regular tabs could not be saved', async () => {
    mocks.saveDirtyRegularOpenTabs.mockResolvedValue(false);

    const opened = await useVaultStore.getState().openVault('/vault/next');

    expect(opened).toBe(false);
    expect(mocks.storage.exists).not.toHaveBeenCalled();
    expect(useVaultStore.getState().currentVault?.path).toBe('/vault/old');
    expect(useVaultStore.getState().error).toBe('Failed to save pending note changes');
  });

  it('does not open another vault if auto-saveable drafts could not be saved', async () => {
    mocks.saveAutoSaveableDrafts.mockResolvedValue(false);

    const opened = await useVaultStore.getState().openVault('/vault/next');

    expect(opened).toBe(false);
    expect(mocks.saveDirtyRegularOpenTabs).not.toHaveBeenCalled();
    expect(mocks.storage.exists).not.toHaveBeenCalled();
    expect(useVaultStore.getState().currentVault?.path).toBe('/vault/old');
    expect(useVaultStore.getState().error).toBe('Failed to save pending draft changes');
  });

  it('opens another vault while preserving unsaved draft tabs', async () => {
    useNotesStore.setState({
      currentNote: { path: 'draft:alpha', content: 'Draft body' },
      isDirty: true,
      openTabs: [{ path: 'draft:alpha', name: '', isDirty: true }],
      draftNotes: { 'draft:alpha': { parentPath: null, name: 'Draft title' } },
      noteContentsCache: new Map([['draft:alpha', { content: 'Draft body', modifiedAt: null }]]),
      noteMetadata: { version: 1, notes: { 'draft:alpha': { icon: 'emoji.sparkles' } } },
    });

    const opened = await useVaultStore.getState().openVault('/vault/next');

    expect(opened).toBe(true);
    expect(useVaultStore.getState().currentVault?.path).toBe('/vault/next');
    expect(useVaultStore.getState().error).toBeNull();
    expect(useNotesStore.getState()).toMatchObject({
      notesPath: '/vault/next',
      currentNote: { path: 'draft:alpha', content: 'Draft body' },
      isDirty: true,
      openTabs: [{ path: 'draft:alpha', name: '', isDirty: true }],
      draftNotes: {
        'draft:alpha': {
          parentPath: null,
          name: 'Draft title',
          originNotesPath: '/vault/old',
        },
      },
    });
    expect(useNotesStore.getState().noteContentsCache.get('draft:alpha')).toEqual({
      content: 'Draft body',
      modifiedAt: null,
    });
    expect(useNotesStore.getState().noteMetadata?.notes['draft:alpha']).toEqual({
      icon: 'emoji.sparkles',
    });
  });

  it('preserves multiple draft tabs while dropping regular tabs on vault switch', async () => {
    useNotesStore.setState({
      currentNote: { path: 'draft:two', content: 'Two body' },
      currentNoteRevision: 7,
      isDirty: true,
      openTabs: [
        { path: 'regular.md', name: 'regular', isDirty: false },
        { path: 'draft:one', name: '', isDirty: true },
        { path: 'draft:two', name: '', isDirty: true },
      ],
      draftNotes: {
        'draft:one': { parentPath: null, name: 'One' },
        'draft:two': { parentPath: 'ideas', name: 'Two' },
      },
      noteContentsCache: new Map([
        ['regular.md', { content: 'Regular', modifiedAt: 1 }],
        ['draft:one', { content: 'One body', modifiedAt: null }],
        ['draft:two', { content: 'Two body', modifiedAt: null }],
      ]),
      noteMetadata: {
        version: 1,
        notes: {
          'regular.md': { icon: 'emoji.file' },
          'draft:one': { icon: 'emoji.one' },
          'draft:two': { cover: { assetPath: '@cover/2', positionX: 50, positionY: 50, height: 200, scale: 1 } },
        },
      },
    });

    const opened = await useVaultStore.getState().openVault('/vault/next');

    expect(opened).toBe(true);
    const state = useNotesStore.getState();
    expect(state.currentNote).toEqual({ path: 'draft:two', content: 'Two body' });
    expect(state.currentNoteRevision).toBe(7);
    expect(state.openTabs).toEqual([
      { path: 'draft:one', name: '', isDirty: true },
      { path: 'draft:two', name: '', isDirty: true },
    ]);
    expect(state.draftNotes).toEqual({
      'draft:one': { parentPath: null, name: 'One', originNotesPath: '/vault/old' },
      'draft:two': { parentPath: 'ideas', name: 'Two', originNotesPath: '/vault/old' },
    });
    expect(Array.from(state.noteContentsCache.keys())).toEqual(['draft:one', 'draft:two']);
    expect(state.noteMetadata?.notes).toEqual({
      'draft:one': { icon: 'emoji.one' },
      'draft:two': { cover: { assetPath: '@cover/2', positionX: 50, positionY: 50, height: 200, scale: 1 } },
    });
  });

  it('saves dirty regular tabs before closing the current vault', async () => {
    const closed = await useVaultStore.getState().closeVault();

    expect(closed).toBe(true);
    expect(mocks.saveDirtyRegularOpenTabs).toHaveBeenCalledTimes(1);
    expect(useVaultStore.getState().currentVault).toBeNull();
    expect(useVaultStore.getState().error).toBeNull();
    expect(useNotesStore.getState()).toMatchObject({
      notesPath: '',
      currentNote: null,
      isDirty: false,
      openTabs: [],
      rootFolder: null,
      rootFolderPath: null,
    });
  });

  it('closes the vault sidebar without replacing the active external starred note', async () => {
    useNotesStore.setState({
      notesPath: '/vault/old',
      currentNote: { path: '/vault/starred/external.md', content: 'External starred' },
      currentNoteRevision: 9,
      isDirty: false,
      openTabs: [
        { path: 'current.md', name: 'current', isDirty: false },
        { path: '/vault/starred/external.md', name: 'external', isDirty: false },
      ],
      rootFolder: {
        id: '',
        name: 'old',
        path: '',
        isFolder: true,
        expanded: true,
        children: [{ id: 'current.md', name: 'current', path: 'current.md', isFolder: false }],
      },
      rootFolderPath: '/vault/old',
      noteContentsCache: new Map([
        ['current.md', { content: 'Current', modifiedAt: 1 }],
        ['/vault/starred/external.md', { content: 'External starred', modifiedAt: 2 }],
      ]),
      noteMetadata: {
        version: 1,
        notes: {
          'current.md': { icon: 'emoji.file' },
          '/vault/starred/external.md': { icon: 'emoji.star' },
        },
      },
      displayNames: new Map([
        ['current.md', 'current'],
        ['/vault/starred/external.md', 'external'],
      ]),
    });

    const closed = await useVaultStore.getState().closeVault();

    expect(closed).toBe(true);
    expect(useVaultStore.getState().currentVault).toBeNull();
    expect(useNotesStore.getState()).toMatchObject({
      notesPath: '',
      currentNote: { path: '/vault/starred/external.md', content: 'External starred' },
      currentNoteRevision: 9,
      isDirty: false,
      openTabs: [{ path: '/vault/starred/external.md', name: 'external', isDirty: false }],
      rootFolder: null,
      rootFolderPath: null,
      draftNotes: {},
    });
    expect(Array.from(useNotesStore.getState().noteContentsCache.keys())).toEqual([
      '/vault/starred/external.md',
    ]);
    expect(useNotesStore.getState().noteMetadata?.notes).toEqual({
      '/vault/starred/external.md': { icon: 'emoji.star' },
    });
    expect(useNotesStore.getState().displayNames.get('/vault/starred/external.md')).toBe('external');
  });

  it('keeps the active starred vault note open as an external note when closing the vault', async () => {
    useNotesStore.setState({
      notesPath: '/vault/old',
      currentNote: { path: 'docs/starred.md', content: 'Starred body' },
      currentNoteRevision: 11,
      isDirty: false,
      openTabs: [
        { path: 'docs/starred.md', name: 'starred', isDirty: false },
        { path: 'docs/regular.md', name: 'regular', isDirty: false },
      ],
      starredEntries: [
        {
          id: 'starred-note',
          kind: 'note',
          vaultPath: '/vault/old',
          relativePath: 'docs/starred.md',
          addedAt: 1,
        },
      ],
      starredNotes: ['docs/starred.md'],
      rootFolder: {
        id: '',
        name: 'old',
        path: '',
        isFolder: true,
        expanded: true,
        children: [
          { id: 'docs/starred.md', name: 'starred', path: 'docs/starred.md', isFolder: false },
          { id: 'docs/regular.md', name: 'regular', path: 'docs/regular.md', isFolder: false },
        ],
      },
      rootFolderPath: '/vault/old',
      noteContentsCache: new Map([
        ['docs/starred.md', { content: 'Starred body', modifiedAt: 2 }],
        ['docs/regular.md', { content: 'Regular body', modifiedAt: 3 }],
      ]),
      noteMetadata: {
        version: 1,
        notes: {
          'docs/starred.md': { icon: 'emoji.star' },
          'docs/regular.md': { icon: 'emoji.file' },
        },
      },
      displayNames: new Map([
        ['docs/starred.md', 'starred'],
        ['docs/regular.md', 'regular'],
      ]),
    });

    const closed = await useVaultStore.getState().closeVault();

    expect(closed).toBe(true);
    expect(useVaultStore.getState().currentVault).toBeNull();
    expect(useNotesStore.getState()).toMatchObject({
      notesPath: '',
      currentNote: { path: '/vault/old/docs/starred.md', content: 'Starred body' },
      currentNoteRevision: 11,
      isDirty: false,
      openTabs: [
        { path: '/vault/old/docs/starred.md', name: 'starred', isDirty: false },
      ],
      rootFolder: null,
      rootFolderPath: null,
      draftNotes: {},
    });
    expect(Array.from(useNotesStore.getState().noteContentsCache.keys())).toEqual([
      '/vault/old/docs/starred.md',
    ]);
    expect(useNotesStore.getState().noteMetadata?.notes).toEqual({
      '/vault/old/docs/starred.md': { icon: 'emoji.star' },
    });
    expect(useNotesStore.getState().displayNames.get('/vault/old/docs/starred.md')).toBe('starred');
  });

  it('preserves the active external note even if it is not present in the tab list', async () => {
    useNotesStore.setState({
      notesPath: '/vault/old',
      currentNote: { path: '/vault/starred/external.md', content: 'External starred' },
      currentNoteRevision: 12,
      isDirty: false,
      openTabs: [{ path: 'current.md', name: 'current', isDirty: false }],
      noteContentsCache: new Map([
        ['current.md', { content: 'Current', modifiedAt: 1 }],
        ['/vault/starred/external.md', { content: 'External starred', modifiedAt: 2 }],
      ]),
      noteMetadata: {
        version: 1,
        notes: {
          'current.md': { icon: 'emoji.file' },
          '/vault/starred/external.md': { icon: 'emoji.star' },
        },
      },
      displayNames: new Map([
        ['current.md', 'current'],
        ['/vault/starred/external.md', 'external'],
      ]),
    });

    const closed = await useVaultStore.getState().closeVault();

    expect(closed).toBe(true);
    expect(useNotesStore.getState()).toMatchObject({
      notesPath: '',
      currentNote: { path: '/vault/starred/external.md', content: 'External starred' },
      currentNoteRevision: 12,
      openTabs: [],
      rootFolder: null,
      rootFolderPath: null,
    });
    expect(Array.from(useNotesStore.getState().noteContentsCache.keys())).toEqual([
      '/vault/starred/external.md',
    ]);
    expect(useNotesStore.getState().noteMetadata?.notes).toEqual({
      '/vault/starred/external.md': { icon: 'emoji.star' },
    });
    expect(useNotesStore.getState().displayNames.get('/vault/starred/external.md')).toBe('external');
  });

  it('does not preserve root-vault absolute notes as external notes when closing the vault', async () => {
    useVaultStore.setState({
      currentVault: {
        id: 'root-vault',
        name: 'root',
        path: '/',
        lastOpened: 1,
      },
      recentVaults: [
        {
          id: 'root-vault',
          name: 'root',
          path: '/',
          lastOpened: 1,
        },
      ],
    });
    useNotesStore.setState({
      notesPath: '/',
      currentNote: { path: '/docs/alpha.md', content: 'Alpha' },
      currentNoteRevision: 3,
      isDirty: false,
      openTabs: [{ path: '/docs/alpha.md', name: 'alpha', isDirty: false }],
      noteContentsCache: new Map([['/docs/alpha.md', { content: 'Alpha', modifiedAt: 1 }]]),
      noteMetadata: {
        version: 1,
        notes: {
          '/docs/alpha.md': { icon: 'emoji.file' },
        },
      },
      displayNames: new Map([['/docs/alpha.md', 'alpha']]),
    });

    const closed = await useVaultStore.getState().closeVault();

    expect(closed).toBe(true);
    expect(useNotesStore.getState()).toMatchObject({
      notesPath: '',
      currentNote: null,
      currentNoteRevision: 0,
      isDirty: false,
      openTabs: [],
    });
    expect(useNotesStore.getState().noteContentsCache.size).toBe(0);
    expect(useNotesStore.getState().displayNames.size).toBe(0);
    expect(useNotesStore.getState().noteMetadata).toBeNull();
  });

  it('saves dirty regular tabs before removing the current vault from recent vaults', async () => {
    const removed = await useVaultStore.getState().removeFromRecent('vault-old');

    expect(removed).toBe(true);
    expect(mocks.saveDirtyRegularOpenTabs).toHaveBeenCalledTimes(1);
    expect(useVaultStore.getState().currentVault).toBeNull();
    expect(useVaultStore.getState().error).toBeNull();
    expect(useNotesStore.getState()).toMatchObject({
      notesPath: '',
      currentNote: null,
      isDirty: false,
      openTabs: [],
    });
  });

  it('does not remove the current vault from recent vaults when dirty regular tabs cannot be saved', async () => {
    mocks.saveDirtyRegularOpenTabs.mockResolvedValue(false);
    useNotesStore.setState({
      currentNote: { path: 'current.md', content: 'Dirty current' },
      isDirty: true,
      openTabs: [{ path: 'current.md', name: 'current', isDirty: true }],
      noteContentsCache: new Map([['current.md', { content: 'Dirty current', modifiedAt: 1 }]]),
    });

    const removed = await useVaultStore.getState().removeFromRecent('vault-old');

    expect(removed).toBe(false);
    expect(useVaultStore.getState().currentVault?.path).toBe('/vault/old');
    expect(useVaultStore.getState().recentVaults).toEqual([
      {
        id: 'vault-old',
        name: 'old',
        path: '/vault/old',
        lastOpened: 1,
      },
    ]);
    expect(useVaultStore.getState().error).toBe('Failed to save pending note changes');
    expect(useNotesStore.getState().currentNote).toEqual({
      path: 'current.md',
      content: 'Dirty current',
    });
    expect(useNotesStore.getState().isDirty).toBe(true);
  });

  it('does not remove the current vault from recent vaults while draft tabs still have unsaved content', async () => {
    useNotesStore.setState({
      currentNote: { path: 'draft:alpha', content: 'Draft body' },
      isDirty: true,
      openTabs: [{ path: 'draft:alpha', name: '', isDirty: true }],
      draftNotes: { 'draft:alpha': { parentPath: null, name: 'Draft title' } },
      noteContentsCache: new Map([['draft:alpha', { content: 'Draft body', modifiedAt: null }]]),
    });

    const removed = await useVaultStore.getState().removeFromRecent('vault-old');

    expect(removed).toBe(false);
    expect(useVaultStore.getState().currentVault?.path).toBe('/vault/old');
    expect(useVaultStore.getState().error).toBe(
      'Save or discard draft notes before switching vaults'
    );
    expect(useNotesStore.getState().currentNote).toEqual({
      path: 'draft:alpha',
      content: 'Draft body',
    });
    expect(useNotesStore.getState().draftNotes).toEqual({
      'draft:alpha': { parentPath: null, name: 'Draft title' },
    });
  });

  it('does not remove the current vault while a cached draft is missing from tabs', async () => {
    useNotesStore.setState({
      currentNote: { path: 'current.md', content: 'Current' },
      isDirty: false,
      openTabs: [{ path: 'current.md', name: 'current', isDirty: false }],
      draftNotes: { 'draft:cached': { parentPath: null, name: '' } },
      noteContentsCache: new Map([['draft:cached', { content: 'Cached draft body', modifiedAt: null }]]),
    });

    const removed = await useVaultStore.getState().removeFromRecent('vault-old');

    expect(removed).toBe(false);
    expect(useVaultStore.getState().currentVault?.path).toBe('/vault/old');
    expect(useVaultStore.getState().error).toBe(
      'Save or discard draft notes before switching vaults'
    );
    expect(useNotesStore.getState().draftNotes).toEqual({
      'draft:cached': { parentPath: null, name: '' },
    });
    expect(useNotesStore.getState().noteContentsCache.get('draft:cached')).toEqual({
      content: 'Cached draft body',
      modifiedAt: null,
    });
  });

  it('does not create a vault folder while a current draft is missing from tabs', async () => {
    useNotesStore.setState({
      currentNote: { path: 'draft:orphan', content: 'Current draft body' },
      isDirty: true,
      openTabs: [],
      draftNotes: { 'draft:orphan': { parentPath: null, name: '' } },
      noteContentsCache: new Map(),
    });

    const created = await useVaultStore.getState().createVault('next', '/vault/next');

    expect(created).toBe(false);
    expect(mocks.storage.mkdir).not.toHaveBeenCalled();
    expect(useVaultStore.getState().currentVault?.path).toBe('/vault/old');
    expect(useVaultStore.getState().error).toBe(
      'Save or discard draft notes before switching vaults'
    );
    expect(useNotesStore.getState().currentNote).toEqual({
      path: 'draft:orphan',
      content: 'Current draft body',
    });
  });

  it('removes a non-current recent vault without touching the note workspace', async () => {
    useVaultStore.setState({
      recentVaults: [
        {
          id: 'vault-old',
          name: 'old',
          path: '/vault/old',
          lastOpened: 1,
        },
        {
          id: 'vault-next',
          name: 'next',
          path: '/vault/next',
          lastOpened: 2,
        },
      ],
    });

    const removed = await useVaultStore.getState().removeFromRecent('vault-next');

    expect(removed).toBe(true);
    expect(mocks.saveDirtyRegularOpenTabs).not.toHaveBeenCalled();
    expect(useVaultStore.getState().currentVault?.path).toBe('/vault/old');
    expect(useVaultStore.getState().recentVaults).toEqual([
      {
        id: 'vault-old',
        name: 'old',
        path: '/vault/old',
        lastOpened: 1,
      },
    ]);
    expect(useNotesStore.getState().currentNote).toEqual({
      path: 'current.md',
      content: 'Current',
    });
  });

  it('does not create a vault folder while draft tabs still have unsaved content', async () => {
    useNotesStore.setState({
      currentNote: { path: 'draft:alpha', content: 'Draft body' },
      isDirty: true,
      openTabs: [{ path: 'draft:alpha', name: '', isDirty: true }],
      draftNotes: { 'draft:alpha': { parentPath: null, name: 'Draft title' } },
      noteContentsCache: new Map([['draft:alpha', { content: 'Draft body', modifiedAt: null }]]),
    });

    const created = await useVaultStore.getState().createVault('next', '/vault/next');

    expect(created).toBe(false);
    expect(mocks.storage.mkdir).not.toHaveBeenCalled();
    expect(useVaultStore.getState().currentVault?.path).toBe('/vault/old');
    expect(useVaultStore.getState().error).toBe(
      'Save or discard draft notes before switching vaults'
    );
  });
});
