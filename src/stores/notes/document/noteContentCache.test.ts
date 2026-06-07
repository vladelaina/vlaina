import { describe, expect, it } from 'vitest';
import { markCachedNoteFresh, setCachedNoteContent } from './noteContentCache';

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

  it('marks a cached note fresh without making cache metadata enumerable', () => {
    const cache = new Map([['docs/alpha.md', { content: '# Alpha', modifiedAt: 7 }]]);

    const nextCache = markCachedNoteFresh(cache, 'docs/alpha.md', 1234);
    const entry = nextCache.get('docs/alpha.md');

    expect(nextCache).not.toBe(cache);
    expect(entry).toEqual({ content: '# Alpha', modifiedAt: 7 });
    expect(entry?.freshUntil).toBe(1234);
  });

  it('tracks disk size without making cache metadata enumerable', () => {
    const cache = new Map([['docs/alpha.md', { content: '# Alpha', modifiedAt: 7 }]]);

    const nextCache = setCachedNoteContent(cache, 'docs/alpha.md', '# Alpha', 7, {
      size: 12,
    });
    const entry = nextCache.get('docs/alpha.md');

    expect(nextCache).not.toBe(cache);
    expect(entry).toEqual({ content: '# Alpha', modifiedAt: 7 });
    expect(entry?.size).toBe(12);
  });

  it('returns a new map when cached disk size changes', () => {
    const cache = setCachedNoteContent(new Map(), 'docs/alpha.md', '# Alpha', 7, {
      size: 12,
    });

    const nextCache = setCachedNoteContent(cache, 'docs/alpha.md', '# Alpha', 7, {
      size: 20,
    });

    expect(nextCache).not.toBe(cache);
    expect(nextCache.get('docs/alpha.md')?.size).toBe(20);
  });
});
