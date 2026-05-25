import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadMentionedNotes, refreshManagedBudgetIfNeeded } from './helpers';

const mocks = vi.hoisted(() => ({
  isConnected: false,
  refreshBudget: vi.fn().mockResolvedValue(undefined),
  flushCurrentPendingEditorMarkdown: vi.fn(),
  notesState: {
    currentNote: null as { path: string; content: string } | null,
    noteContentsCache: new Map<string, { content: string }>(),
    notesPath: '/vault',
  },
}));

vi.mock('@/stores/accountSession', () => ({
  useAccountSessionStore: {
    getState: () => ({
      isConnected: mocks.isConnected,
    }),
  },
}));

vi.mock('@/stores/useManagedAIStore', () => ({
  useManagedAIStore: {
    getState: () => ({
      refreshBudget: mocks.refreshBudget,
    }),
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

describe('refreshManagedBudgetIfNeeded', () => {
  beforeEach(() => {
    mocks.isConnected = false;
    mocks.refreshBudget.mockClear();
    mocks.flushCurrentPendingEditorMarkdown.mockClear();
    mocks.notesState.currentNote = null;
    mocks.notesState.noteContentsCache = new Map();
    mocks.notesState.notesPath = '/vault';
  });

  it('does not refresh budget for custom providers', () => {
    mocks.isConnected = true;

    refreshManagedBudgetIfNeeded('provider-1');

    expect(mocks.refreshBudget).not.toHaveBeenCalled();
  });

  it('does not refresh budget for managed providers after sign-out', () => {
    mocks.isConnected = false;

    refreshManagedBudgetIfNeeded('vlaina-managed');

    expect(mocks.refreshBudget).not.toHaveBeenCalled();
  });

  it('refreshes budget for managed providers while signed in', () => {
    mocks.isConnected = true;

    refreshManagedBudgetIfNeeded('vlaina-managed');

    expect(mocks.refreshBudget).toHaveBeenCalledTimes(1);
  });
});

describe('loadMentionedNotes', () => {
  beforeEach(() => {
    mocks.flushCurrentPendingEditorMarkdown.mockClear();
    mocks.notesState.currentNote = null;
    mocks.notesState.noteContentsCache = new Map();
    mocks.notesState.notesPath = '/vault';
  });

  it('flushes pending editor markdown before reading the current note mention', async () => {
    mocks.notesState.currentNote = { path: 'docs/alpha.md', content: '# old' };
    mocks.notesState.noteContentsCache = new Map([
      ['docs/alpha.md', { content: '# old' }],
    ]);
    mocks.flushCurrentPendingEditorMarkdown.mockImplementation(() => {
      mocks.notesState.currentNote = {
        path: 'docs/alpha.md',
        content: '# pending edit',
      };
      mocks.notesState.noteContentsCache = new Map([
        ['docs/alpha.md', { content: '# pending edit' }],
      ]);
      return true;
    });

    const notes = await loadMentionedNotes([
      { path: 'docs/alpha.md', title: 'Alpha' },
    ]);

    expect(mocks.flushCurrentPendingEditorMarkdown).toHaveBeenCalledTimes(1);
    expect(notes).toEqual([
      { path: 'docs/alpha.md', title: 'Alpha', content: '# pending edit' },
    ]);
  });
});
