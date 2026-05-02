import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const hoisted = vi.hoisted(() => ({
  persistWorkspaceSnapshot: vi.fn(),
}));

vi.mock('../workspacePersistence', () => ({
  persistWorkspaceSnapshot: hoisted.persistWorkspaceSnapshot,
}));

import { createFileSystemSlice } from './fileSystemSlice';
import { replaceCurrentTabOrAppend } from './fileSystemSliceHelpers';
import { setCurrentVaultPath } from '../storage';

function createSliceHarness(overrides: Record<string, unknown> = {}) {
  let state: any;

  const set = (partial: any) => {
    const nextState = typeof partial === 'function' ? partial(state) : partial;
    state = { ...state, ...nextState };
  };

  const get = () => state;
  const slice = createFileSystemSlice(set as never, get as never, {} as never);

  state = {
    ...slice,
    currentNote: null,
    currentNoteRevision: 0,
    isDirty: false,
    error: null,
    recentNotes: [],
    openTabs: [],
    noteContentsCache: new Map(),
    draftNotes: {},
    noteMetadata: null,
    displayNames: new Map(),
    saveNote: vi.fn(),
    ...overrides,
  };

  return {
    getState: () => state,
  };
}

describe('createFileSystemSlice draft flows', () => {
  beforeEach(() => {
    setCurrentVaultPath(null);
    vi.clearAllMocks();
  });

  it('creates an unsaved draft note when no vault is selected', async () => {
    const harness = createSliceHarness();

    const draftPath = await harness.getState().createNote();
    const state = harness.getState();

    expect(draftPath).toMatch(/^draft:/);
    expect(state.notesPath).toBe('');
    expect(state.currentNote).toEqual({ path: draftPath, content: '' });
    expect(state.openTabs).toEqual([{ path: draftPath, name: '', isDirty: false }]);
    expect(state.draftNotes[draftPath]).toEqual({ parentPath: null, name: '' });
    expect(state.displayNames.get(draftPath)).toBe('');
    expect(state.noteContentsCache.get(draftPath)).toEqual({ content: '', modifiedAt: null });
    expect(state.saveNote).not.toHaveBeenCalled();
  });

  it('does not create a draft note when creating a folder without a selected vault', async () => {
    const harness = createSliceHarness();

    const result = await harness.getState().createFolder('');
    const state = harness.getState();

    expect(result).toBeNull();
    expect(state.notesPath).toBe('');
    expect(state.currentNote).toBeNull();
    expect(state.openTabs).toEqual([]);
    expect(state.draftNotes).toEqual({});
    expect(state.displayNames.size).toBe(0);
  });

  it('creates another draft tab without saving or replacing the dirty current draft', async () => {
    const harness = createSliceHarness();
    const cache = new Map([['draft:current', { content: 'draft text', modifiedAt: null }]]);
    harness.getState().currentNote = { path: 'draft:current', content: 'draft text' };
    harness.getState().isDirty = true;
    harness.getState().openTabs = [{ path: 'draft:current', name: '', isDirty: true }];
    harness.getState().draftNotes = {
      'draft:current': { parentPath: null, name: '' },
    };
    harness.getState().noteContentsCache = cache;

    const draftPath = await harness.getState().createNote();
    const state = harness.getState();

    expect(state.saveNote).not.toHaveBeenCalled();
    expect(state.currentNote).toEqual({ path: draftPath, content: '' });
    expect(state.openTabs).toEqual([
      { path: 'draft:current', name: '', isDirty: true },
      { path: draftPath, name: '', isDirty: false },
    ]);
    expect(state.noteContentsCache.get('draft:current')).toEqual({
      content: 'draft text',
      modifiedAt: null,
    });
  });
});

describe('createFileSystemSlice tree flows', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('expands folders immediately and defers workspace persistence', () => {
    const harness = createSliceHarness({
      notesPath: '/vault',
      currentNote: { path: 'alpha.md', content: '# alpha' },
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
            expanded: false,
            children: [],
          },
        ],
      },
    });

    harness.getState().toggleFolder('docs');

    expect(harness.getState().rootFolder.children[0].expanded).toBe(true);
    expect(hoisted.persistWorkspaceSnapshot).not.toHaveBeenCalled();

    vi.runOnlyPendingTimers();

    expect(hoisted.persistWorkspaceSnapshot).toHaveBeenCalledWith('/vault', expect.objectContaining({
      currentNotePath: 'alpha.md',
      rootFolder: expect.objectContaining({
        children: [
          expect.objectContaining({
            path: 'docs',
            expanded: true,
          }),
        ],
      }),
    }));
  });

  it('uses the latest current note when deferred folder persistence flushes', () => {
    const harness = createSliceHarness({
      notesPath: '/vault',
      currentNote: { path: 'alpha.md', content: '# alpha' },
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
            expanded: false,
            children: [],
          },
        ],
      },
    });

    harness.getState().toggleFolder('docs');
    harness.getState().currentNote = { path: 'beta.md', content: '# beta' };

    vi.runOnlyPendingTimers();

    expect(hoisted.persistWorkspaceSnapshot).toHaveBeenCalledWith('/vault', expect.objectContaining({
      currentNotePath: 'beta.md',
    }));
  });
});

describe('replaceCurrentTabOrAppend', () => {
  it('appends a new tab instead of replacing an external note tab', () => {
    expect(
      replaceCurrentTabOrAppend(
        [{ path: '/other-vault/starred.md', name: 'starred', isDirty: false }],
        '/other-vault/starred.md',
        { path: 'Untitled.md', name: 'Untitled', isDirty: false },
      ),
    ).toEqual([
      { path: '/other-vault/starred.md', name: 'starred', isDirty: false },
      { path: 'Untitled.md', name: 'Untitled', isDirty: false },
    ]);
  });
});
