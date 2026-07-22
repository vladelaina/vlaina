import { describe, expect, it } from 'vitest';
import type { NotesStore } from '../types';
import { preserveDirtyCurrentNoteContent } from './workspaceOpenNoteSupport';

describe('preserveDirtyCurrentNoteContent', () => {
  it('writes the active dirty content only at a navigation boundary', () => {
    const cachedEntry = { content: '# Saved', modifiedAt: 4 };
    Object.defineProperties(cachedEntry, {
      freshUntil: { configurable: true, value: 10 },
      size: { configurable: true, value: 7 },
    });
    const cache = new Map([['Alpha.md', cachedEntry]]);
    const state = {
      currentNote: { path: 'Alpha.md', content: '# Edited' },
      isDirty: true,
      noteContentsCache: cache,
    } as NotesStore;

    const preserved = preserveDirtyCurrentNoteContent(state, 'Beta.md');

    expect(preserved).not.toBe(cache);
    expect(preserved.get('Alpha.md')?.content).toBe('# Edited');
    expect(preserved.get('Alpha.md')?.savedContent).toBe('# Saved');
    expect(preserved.get('Alpha.md')?.freshUntil).toBe(10);
    expect(preserved.get('Alpha.md')?.size).toBe(7);
  });

  it('keeps the cache stable when the note is not being left', () => {
    const cache = new Map([['Alpha.md', { content: '# Saved', modifiedAt: 4 }]]);
    const state = {
      currentNote: { path: 'Alpha.md', content: '# Edited' },
      isDirty: true,
      noteContentsCache: cache,
    } as NotesStore;

    expect(preserveDirtyCurrentNoteContent(state, 'Alpha.md')).toBe(cache);
  });
});
