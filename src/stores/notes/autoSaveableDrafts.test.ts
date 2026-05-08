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
      notesPath: '/vault',
      currentNote: null,
      isDirty: false,
      openTabs: [],
      draftNotes: {},
      noteContentsCache: new Map(),
      noteMetadata: { version: 1, notes: {} },
    });
  });

  it('separates drafts that can autosave into the current vault from drafts that need confirmation', () => {
    useNotesStore.setState({
      currentNote: { path: 'draft:auto', content: 'Auto body' },
      draftNotes: {
        'draft:auto': { parentPath: null, name: 'Auto' },
        'draft:other-vault': { parentPath: null, name: 'Other', originNotesPath: '/other' },
      },
      noteContentsCache: new Map([
        ['draft:auto', { content: 'Auto body', modifiedAt: null }],
        ['draft:other-vault', { content: 'Other body', modifiedAt: null }],
      ]),
    });

    expect(getAutoSaveableDraftPaths()).toEqual(['draft:auto']);
    expect(getDiscardableDraftPaths()).toEqual(['draft:other-vault']);
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
