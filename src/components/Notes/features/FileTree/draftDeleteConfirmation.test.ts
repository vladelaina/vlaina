import { describe, expect, it } from 'vitest';
import { canDeleteDraftWithoutConfirmation } from './draftDeleteConfirmation';
import type { NotesStore } from '@/stores/useNotesStore';

function createState(overrides: Partial<NotesStore> = {}) {
  return {
    currentNote: null,
    draftNotes: {},
    noteContentsCache: new Map(),
    noteMetadata: null,
    ...overrides,
  } as Pick<NotesStore, 'currentNote' | 'draftNotes' | 'noteContentsCache' | 'noteMetadata'>;
}

describe('canDeleteDraftWithoutConfirmation', () => {
  it('allows blank untitled drafts to be deleted without confirmation', () => {
    const state = createState({
      currentNote: { path: 'draft:blank', content: '' },
      draftNotes: {
        'draft:blank': { parentPath: 'docs', name: '' },
      },
    });

    expect(canDeleteDraftWithoutConfirmation('draft:blank', state)).toBe(true);
  });

  it('keeps confirmation for drafts with a title, content, or metadata', () => {
    expect(canDeleteDraftWithoutConfirmation('draft:titled', createState({
      currentNote: { path: 'draft:titled', content: '' },
      draftNotes: {
        'draft:titled': { parentPath: null, name: 'Plan' },
      },
    }))).toBe(false);

    expect(canDeleteDraftWithoutConfirmation('draft:content', createState({
      currentNote: { path: 'draft:content', content: 'Hello' },
      draftNotes: {
        'draft:content': { parentPath: null, name: '' },
      },
    }))).toBe(false);

    expect(canDeleteDraftWithoutConfirmation('draft:metadata', createState({
      currentNote: { path: 'draft:metadata', content: '' },
      draftNotes: {
        'draft:metadata': { parentPath: null, name: '' },
      },
      noteMetadata: {
        version: 1,
        notes: {
          'draft:metadata': { icon: 'note' },
        },
      },
    }))).toBe(false);
  });

  it('uses current note content before cached draft content', () => {
    const state = createState({
      currentNote: { path: 'draft:active', content: 'Unsaved text' },
      draftNotes: {
        'draft:active': { parentPath: null, name: '' },
      },
      noteContentsCache: new Map([
        ['draft:active', { content: '', modifiedAt: null }],
      ]),
    });

    expect(canDeleteDraftWithoutConfirmation('draft:active', state)).toBe(false);
  });
});
