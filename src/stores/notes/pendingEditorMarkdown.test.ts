import { beforeEach, describe, expect, it } from 'vitest';
import { useNotesStore } from '@/stores/useNotesStore';
import { flushPendingEditorMarkdown } from './pendingEditorMarkdown';

describe('flushPendingEditorMarkdown', () => {
  beforeEach(() => {
    useNotesStore.setState({
      currentNote: null,
      currentNoteRevision: 0,
      isDirty: false,
      openTabs: [],
      noteContentsCache: new Map(),
    });
  });

  it('flushes pending markdown into the active note before an editor instance is removed', () => {
    useNotesStore.setState({
      currentNote: { path: 'alpha.md', content: 'Old content' },
      currentNoteRevision: 3,
      isDirty: false,
      openTabs: [{ path: 'alpha.md', name: 'alpha', isDirty: false }],
      noteContentsCache: new Map([['alpha.md', { content: 'Old content', modifiedAt: 7 }]]),
    });

    const didFlush = flushPendingEditorMarkdown('alpha.md', 'Unsaved content');

    const state = useNotesStore.getState();
    expect(didFlush).toBe(true);
    expect(state.currentNote).toEqual({ path: 'alpha.md', content: 'Unsaved content' });
    expect(state.currentNoteRevision).toBe(4);
    expect(state.isDirty).toBe(true);
    expect(state.openTabs).toEqual([{ path: 'alpha.md', name: 'alpha', isDirty: true }]);
    expect(state.noteContentsCache.get('alpha.md')).toEqual({
      content: 'Unsaved content',
      modifiedAt: 7,
    });
  });

  it('does not re-dirty a clean note when pending markdown only differs by save normalization', () => {
    const savedContent = ['1. First item', '2. Second item', '3. Third item'].join('\n');
    const pendingContent = ['1. First item', '', '2. Second item', '3. Third item'].join('\n');

    useNotesStore.setState({
      currentNote: { path: 'alpha.md', content: savedContent },
      currentNoteRevision: 3,
      isDirty: false,
      openTabs: [{ path: 'alpha.md', name: 'alpha', isDirty: false }],
      noteContentsCache: new Map([['alpha.md', { content: savedContent, modifiedAt: 7 }]]),
    });

    const didFlush = flushPendingEditorMarkdown('alpha.md', pendingContent);

    const state = useNotesStore.getState();
    expect(didFlush).toBe(false);
    expect(state.currentNote).toEqual({ path: 'alpha.md', content: savedContent });
    expect(state.currentNoteRevision).toBe(3);
    expect(state.isDirty).toBe(false);
    expect(state.openTabs).toEqual([{ path: 'alpha.md', name: 'alpha', isDirty: false }]);
    expect(state.noteContentsCache.get('alpha.md')).toEqual({
      content: savedContent,
      modifiedAt: 7,
    });
  });

  it('does not restore a dirty background tab when a stale editor flush is save-normalization equivalent', () => {
    const savedContent = [
      '---',
      'vlaina_updated: "2026-05-08T08:05:50.781Z"',
      '---',
      '# 3',
      '',
      '1. First item',
      '2. Second item',
    ].join('\n');
    const pendingContent = [
      '---',
      'vlaina_updated: "2026-05-08T08:05:50.781Z"',
      '---',
      '# 3',
      '',
      '1. First item',
      '',
      '2. Second item',
    ].join('\n');

    useNotesStore.setState({
      currentNote: { path: 'beta.md', content: 'Beta content' },
      currentNoteRevision: 8,
      isDirty: false,
      openTabs: [
        { path: 'alpha.md', name: 'alpha', isDirty: false },
        { path: 'beta.md', name: 'beta', isDirty: false },
      ],
      noteContentsCache: new Map([
        ['alpha.md', { content: savedContent, modifiedAt: 17 }],
        ['beta.md', { content: 'Beta content', modifiedAt: 3 }],
      ]),
    });

    const didFlush = flushPendingEditorMarkdown('alpha.md', pendingContent);

    const state = useNotesStore.getState();
    expect(didFlush).toBe(false);
    expect(state.currentNote).toEqual({ path: 'beta.md', content: 'Beta content' });
    expect(state.currentNoteRevision).toBe(8);
    expect(state.isDirty).toBe(false);
    expect(state.openTabs).toEqual([
      { path: 'alpha.md', name: 'alpha', isDirty: false },
      { path: 'beta.md', name: 'beta', isDirty: false },
    ]);
    expect(state.noteContentsCache.get('alpha.md')).toEqual({
      content: savedContent,
      modifiedAt: 17,
    });
  });

  it('flushes pending markdown into a background tab without changing the active note', () => {
    useNotesStore.setState({
      currentNote: { path: 'beta.md', content: 'Beta content' },
      currentNoteRevision: 4,
      isDirty: false,
      openTabs: [
        { path: 'alpha.md', name: 'alpha', isDirty: false },
        { path: 'beta.md', name: 'beta', isDirty: false },
      ],
      noteContentsCache: new Map([
        ['alpha.md', { content: 'Old alpha', modifiedAt: 2 }],
        ['beta.md', { content: 'Beta content', modifiedAt: 3 }],
      ]),
    });

    const didFlush = flushPendingEditorMarkdown('alpha.md', 'Unsaved alpha');

    const state = useNotesStore.getState();
    expect(didFlush).toBe(true);
    expect(state.currentNote).toEqual({ path: 'beta.md', content: 'Beta content' });
    expect(state.currentNoteRevision).toBe(4);
    expect(state.isDirty).toBe(false);
    expect(state.openTabs).toEqual([
      { path: 'alpha.md', name: 'alpha', isDirty: true },
      { path: 'beta.md', name: 'beta', isDirty: false },
    ]);
    expect(state.noteContentsCache.get('alpha.md')).toEqual({
      content: 'Unsaved alpha',
      modifiedAt: 2,
    });
  });

  it('restores a dirty tab if navigation already replaced it before the editor flushed', () => {
    useNotesStore.setState({
      currentNote: { path: 'beta.md', content: 'Beta content' },
      currentNoteRevision: 4,
      isDirty: false,
      openTabs: [{ path: 'beta.md', name: 'beta', isDirty: false }],
      noteContentsCache: new Map([['alpha.md', { content: 'Old alpha', modifiedAt: 2 }]]),
    });

    const didFlush = flushPendingEditorMarkdown('alpha.md', 'Unsaved alpha');

    const state = useNotesStore.getState();
    expect(didFlush).toBe(true);
    expect(state.currentNote).toEqual({ path: 'beta.md', content: 'Beta content' });
    expect(state.openTabs).toEqual([
      { path: 'beta.md', name: 'beta', isDirty: false },
      { path: 'alpha.md', name: 'alpha', isDirty: true },
    ]);
    expect(state.noteContentsCache.get('alpha.md')).toEqual({
      content: 'Unsaved alpha',
      modifiedAt: 2,
    });
  });

  it('ignores a stale editor flush after the workspace has been reset', () => {
    useNotesStore.setState({
      notesPath: '/next-vault',
      currentNote: null,
      currentNoteRevision: 0,
      isDirty: false,
      openTabs: [],
      noteContentsCache: new Map(),
    });

    const didFlush = flushPendingEditorMarkdown('alpha.md', 'Old vault draft');

    const state = useNotesStore.getState();
    expect(didFlush).toBe(false);
    expect(state.currentNote).toBeNull();
    expect(state.openTabs).toEqual([]);
    expect(state.noteContentsCache.size).toBe(0);
    expect(state.isDirty).toBe(false);
  });
});
