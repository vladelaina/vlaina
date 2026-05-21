import { describe, expect, it } from 'vitest';
import { setCachedNoteContent } from './noteContentCache';

describe('noteContentCache', () => {
  it('reuses the existing map when cached content is unchanged', () => {
    const cache = new Map([['docs/alpha.md', { content: '# Alpha', modifiedAt: 7 }]]);

    const nextCache = setCachedNoteContent(cache, 'docs/alpha.md', '# Alpha', 7);

    expect(nextCache).toBe(cache);
  });

  it('returns a new map when content changes', () => {
    const cache = new Map([['docs/alpha.md', { content: '# Alpha', modifiedAt: 7 }]]);

    const nextCache = setCachedNoteContent(cache, 'docs/alpha.md', '# Beta', 7);

    expect(nextCache).not.toBe(cache);
    expect(nextCache.get('docs/alpha.md')).toEqual({ content: '# Beta', modifiedAt: 7 });
  });
});
