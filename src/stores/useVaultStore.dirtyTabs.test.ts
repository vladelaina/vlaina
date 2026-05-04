import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  storage: {
    platform: 'electron' as const,
    exists: vi.fn(),
    mkdir: vi.fn(),
    rename: vi.fn(),
  },
  ensureVaultConfig: vi.fn(),
  saveDirtyRegularOpenTabs: vi.fn(),
}));

vi.mock('@/lib/storage/adapter', () => ({
  getStorageAdapter: () => mocks.storage,
}));

vi.mock('./vaultConfig', () => ({
  ensureVaultConfig: mocks.ensureVaultConfig,
  normalizeVaultPath: (path: string) => path.replace(/\\/g, '/'),
}));

vi.mock('@/stores/notes/dirtyOpenTabs', () => ({
  saveDirtyRegularOpenTabs: mocks.saveDirtyRegularOpenTabs,
}));

import { useNotesStore } from './useNotesStore';
import { useVaultStore } from './useVaultStore';

describe('useVaultStore dirty note protection', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    mocks.storage.exists.mockResolvedValue(true);
    mocks.ensureVaultConfig.mockResolvedValue(undefined);
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
      error: null,
    });

    useNotesStore.setState({
      notesPath: '/vault/old',
      currentNote: { path: 'current.md', content: 'Current' },
      isDirty: false,
      openTabs: [{ path: 'current.md', name: 'current', isDirty: false }],
      noteContentsCache: new Map(),
      draftNotes: {},
      noteMetadata: { version: 1, notes: {} },
    });
  });

  it('saves dirty regular tabs before opening another vault', async () => {
    const opened = await useVaultStore.getState().openVault('/vault/next');

    expect(opened).toBe(true);
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
      rootFolder: null,
      draftNotes: {},
    });
    expect(useNotesStore.getState().noteContentsCache.size).toBe(0);
    expect(useNotesStore.getState().displayNames.size).toBe(0);
  });

  it('does not open another vault if dirty regular tabs could not be saved', async () => {
    mocks.saveDirtyRegularOpenTabs.mockResolvedValue(false);

    const opened = await useVaultStore.getState().openVault('/vault/next');

    expect(opened).toBe(false);
    expect(mocks.storage.exists).not.toHaveBeenCalled();
    expect(useVaultStore.getState().currentVault?.path).toBe('/vault/old');
    expect(useVaultStore.getState().error).toBe('Failed to save pending note changes');
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
