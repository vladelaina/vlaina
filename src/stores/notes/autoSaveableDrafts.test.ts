import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useNotesStore } from '../useNotesStore';
import { getAutoSaveableDraftPaths, getDiscardableDraftPaths, saveAutoSaveableDrafts } from './autoSaveableDrafts';
import {
  flushPendingEditorMarkdown,
  setPendingEditorMarkdownFlusher,
} from './pendingEditorMarkdown';

describe('autoSaveableDrafts', () => {
  beforeEach(() => {
    setPendingEditorMarkdownFlusher(null);
    useNotesStore.setState({
      notesPath: '/notesRoot',
      currentNote: null,
      isDirty: false,
      openTabs: [],
      draftNotes: {},
      noteContentsCache: new Map(),
      noteMetadata: { version: 1, notes: {} },
    });
  });

  it('separates drafts that can autosave into the opened folder from drafts that need confirmation', () => {
    useNotesStore.setState({
      currentNote: { path: 'draft:auto', content: 'Auto body' },
      draftNotes: {
        'draft:auto': { parentPath: null, name: 'Auto' },
        'draft:other-notesRoot': { parentPath: null, name: 'Other', originNotesPath: '/other' },
      },
      noteContentsCache: new Map([
        ['draft:auto', { content: 'Auto body', modifiedAt: null }],
        ['draft:other-notesRoot', { content: 'Other body', modifiedAt: null }],
      ]),
    });

    expect(getAutoSaveableDraftPaths()).toEqual(['draft:auto']);
    expect(getDiscardableDraftPaths()).toEqual(['draft:other-notesRoot']);
  });

  it('flushes pending editor markdown before saving auto-saveable drafts', async () => {
    const saveNote = vi.fn(async () => {
      useNotesStore.setState((state) => {
        const currentPath = state.currentNote?.path ?? 'draft:auto';
        const nextDraftNotes = { ...state.draftNotes };
        delete nextDraftNotes[currentPath];
        return {
          currentNote: { path: 'Auto.md', content: state.currentNote?.content ?? '' },
          isDirty: false,
          draftNotes: nextDraftNotes,
          openTabs: [{ path: 'Auto.md', name: 'Auto', isDirty: false }],
        };
      });
    });
    useNotesStore.setState({
      currentNote: { path: 'draft:auto', content: 'Old body' },
      isDirty: false,
      openTabs: [{ path: 'draft:auto', name: '', isDirty: false }],
      draftNotes: { 'draft:auto': { parentPath: null, name: 'Auto' } },
      saveNote,
    });
    setPendingEditorMarkdownFlusher(() =>
      flushPendingEditorMarkdown('draft:auto', 'Pending body')
    );

    await expect(saveAutoSaveableDrafts()).resolves.toBe(true);

    expect(saveNote).toHaveBeenCalledWith({ suppressOpenTarget: true });
    expect(useNotesStore.getState().currentNote).toEqual({
      path: 'Auto.md',
      content: 'Pending body',
    });
  });

  it('restores the originally focused note after saving a cached auto-saveable draft', async () => {
    const openNote = vi.fn(async (path: string) => {
      useNotesStore.setState((state) => ({
        currentNote: {
          path,
          content: state.noteContentsCache.get(path)?.content ?? '',
        },
        isDirty: Boolean(state.openTabs.find((tab) => tab.path === path)?.isDirty),
      }));
    });
    const saveNote = vi.fn(async () => {
      useNotesStore.setState((state) => {
        const nextDraftNotes = { ...state.draftNotes };
        const nextCache = new Map(state.noteContentsCache);
        delete nextDraftNotes['draft:auto'];
        nextCache.delete('draft:auto');
        nextCache.set('Auto.md', { content: 'Auto body', modifiedAt: 2 });
        return {
          currentNote: { path: 'Auto.md', content: 'Auto body' },
          isDirty: false,
          draftNotes: nextDraftNotes,
          openTabs: [
            { path: 'docs/current.md', name: 'current', isDirty: false },
            { path: 'Auto.md', name: 'Auto', isDirty: false },
          ],
          noteContentsCache: nextCache,
        };
      });
    });
    useNotesStore.setState({
      currentNote: { path: 'docs/current.md', content: '# current' },
      isDirty: false,
      openTabs: [{ path: 'docs/current.md', name: 'current', isDirty: false }],
      draftNotes: { 'draft:auto': { parentPath: null, name: 'Auto' } },
      noteContentsCache: new Map([
        ['docs/current.md', { content: '# current', modifiedAt: 1 }],
        ['draft:auto', { content: 'Auto body', modifiedAt: null }],
      ]),
      openNote,
      saveNote,
    });

    await expect(saveAutoSaveableDrafts()).resolves.toBe(true);

    expect(saveNote).toHaveBeenCalledWith({ suppressOpenTarget: true });
    expect(openNote).toHaveBeenCalledWith('draft:auto');
    expect(openNote).toHaveBeenCalledWith('docs/current.md', undefined);
    expect(useNotesStore.getState().currentNote).toEqual({
      path: 'docs/current.md',
      content: '# current',
    });
  });

  it('restores the originally focused note when a cached auto-saveable draft fails to save', async () => {
    const openNote = vi.fn(async (path: string) => {
      useNotesStore.setState((state) => ({
        currentNote: {
          path,
          content: state.noteContentsCache.get(path)?.content ?? '',
        },
        isDirty: Boolean(state.openTabs.find((tab) => tab.path === path)?.isDirty),
      }));
    });
    const saveNote = vi.fn().mockResolvedValue(undefined);
    useNotesStore.setState({
      currentNote: { path: 'docs/current.md', content: '# current' },
      isDirty: false,
      openTabs: [{ path: 'docs/current.md', name: 'current', isDirty: false }],
      draftNotes: { 'draft:auto': { parentPath: null, name: 'Auto' } },
      noteContentsCache: new Map([
        ['docs/current.md', { content: '# current', modifiedAt: 1 }],
        ['draft:auto', { content: 'Auto body', modifiedAt: null }],
      ]),
      openNote,
      saveNote,
    });

    await expect(saveAutoSaveableDrafts()).resolves.toBe(false);

    expect(saveNote).toHaveBeenCalledWith({ suppressOpenTarget: true });
    expect(openNote).toHaveBeenCalledWith('docs/current.md', undefined);
    expect(useNotesStore.getState().currentNote).toEqual({
      path: 'docs/current.md',
      content: '# current',
    });
  });

  it('returns false when an auto-saveable draft remains a draft after save', async () => {
    const saveNote = vi.fn().mockResolvedValue(undefined);
    useNotesStore.setState({
      currentNote: { path: 'draft:auto', content: 'Auto body' },
      isDirty: true,
      openTabs: [{ path: 'draft:auto', name: '', isDirty: true }],
      draftNotes: { 'draft:auto': { parentPath: null, name: 'Auto' } },
      saveNote,
    });

    await expect(saveAutoSaveableDrafts()).resolves.toBe(false);
  });

  it('returns false when saving an auto-saveable draft throws', async () => {
    const saveNote = vi.fn().mockRejectedValue(new Error('disk full'));
    useNotesStore.setState({
      currentNote: { path: 'draft:auto', content: 'Auto body' },
      isDirty: true,
      openTabs: [{ path: 'draft:auto', name: '', isDirty: true }],
      draftNotes: { 'draft:auto': { parentPath: null, name: 'Auto' } },
      saveNote,
    });

    await expect(saveAutoSaveableDrafts()).resolves.toBe(false);
  });
});
