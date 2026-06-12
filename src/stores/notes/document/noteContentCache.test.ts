import { describe, expect, it } from 'vitest';
import {
  createCachedNoteContentEntry,
  getCachedNoteModifiedAt,
  getCachedNoteSize,
  limitCachedNoteContents,
  markCachedNoteFresh,
  setCachedNoteContent,
} from './noteContentCache';

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

  it('normalizes invalid timestamp and size metadata', () => {
    const entry = createCachedNoteContentEntry('# Alpha', Number.NaN, {
      size: -1,
    });

    expect(entry).toEqual({ content: '# Alpha', modifiedAt: null });
    expect(entry.size).toBeNull();

    const cache = setCachedNoteContent(new Map(), 'docs/alpha.md', '# Alpha', Number.POSITIVE_INFINITY, {
      size: Number.NaN,
    });

    expect(getCachedNoteModifiedAt(cache, 'docs/alpha.md')).toBeNull();
    expect(getCachedNoteSize(cache, 'docs/alpha.md')).toBeNull();
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

  it('limits cached content by total content length', () => {
    const cache = new Map([
      ['docs/alpha.md', { content: 'a'.repeat(8), modifiedAt: 1 }],
      ['docs/beta.md', { content: 'b'.repeat(8), modifiedAt: 1 }],
      ['docs/gamma.md', { content: 'c'.repeat(8), modifiedAt: 1 }],
    ]);

    const nextCache = limitCachedNoteContents(cache, new Set(), 10, {
      maxContentChars: 16,
    });

    expect(nextCache).not.toBe(cache);
    expect([...nextCache.keys()]).toEqual(['docs/beta.md', 'docs/gamma.md']);
  });

  it('keeps protected cached content when total content still exceeds the limit', () => {
    const cache = new Map([
      ['docs/alpha.md', { content: 'a'.repeat(8), modifiedAt: 1 }],
      ['docs/beta.md', { content: 'b'.repeat(20), modifiedAt: 1 }],
      ['docs/gamma.md', { content: 'c'.repeat(8), modifiedAt: 1 }],
    ]);

    const nextCache = limitCachedNoteContents(cache, new Set(['docs/beta.md']), 10, {
      maxContentChars: 16,
    });

    expect([...nextCache.keys()]).toEqual(['docs/beta.md']);
  });

  it('counts saved baseline content toward the total cache limit', () => {
    let cache = setCachedNoteContent(new Map(), 'docs/alpha.md', 'saved-alpha', 1);
    cache = setCachedNoteContent(cache, 'docs/alpha.md', 'dirty-alpha', 1);
    cache = setCachedNoteContent(cache, 'docs/beta.md', 'beta', 1);

    const nextCache = limitCachedNoteContents(cache, new Set(), 10, {
      maxContentChars: 'dirty-alpha'.length + 'saved-alpha'.length - 1,
    });

    expect([...nextCache.keys()]).toEqual(['docs/beta.md']);
  });
});
