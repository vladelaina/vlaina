import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFileSystemSlice } from './fileSystemSlice';
import { setCurrentVaultPath } from '../storage';

describe('createFileSystemSlice.createNote', () => {
  beforeEach(() => {
    setCurrentVaultPath(null);
  });

  it('creates an unsaved draft when no vault is selected', async () => {
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
    };

    const draftPath = await state.createNote();

    expect(draftPath).toMatch(/^draft:/);
    expect(state.notesPath).toBe('');
    expect(state.currentNote).toEqual({ path: draftPath, content: '' });
    expect(state.openTabs).toEqual([{ path: draftPath, name: '', isDirty: false }]);
    expect(state.draftNotes[draftPath]).toEqual({ parentPath: null, name: '' });
    expect(state.displayNames.get(draftPath)).toBe('');
    expect(state.noteContentsCache.get(draftPath)).toEqual({ content: '', modifiedAt: null });
    expect(state.saveNote).not.toHaveBeenCalled();
  });
});
