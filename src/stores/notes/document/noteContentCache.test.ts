import { describe, expect, it } from 'vitest';
import {
  getCachedNoteContent,
  pruneCachedNoteContents,
  remapCachedNoteContents,
  removeCachedNoteContent,
  setCachedNoteContent,
} from './noteContentCache';

describe('noteContentCache', () => {
  it('stores content with modified time metadata', () => {
    const nextCache = setCachedNoteContent(new Map(), 'docs/alpha.md', '# Alpha', 123);

    expect(getCachedNoteContent(nextCache, 'docs/alpha.md')).toBe('# Alpha');
    expect(nextCache.get('docs/alpha.md')?.modifiedAt).toBe(123);
  });

  it('remaps note paths without losing content', () => {
    const cache = new Map([
      ['docs/alpha.md', { content: '# Alpha', modifiedAt: 10 }],
      ['docs/beta.md', { content: '# Beta', modifiedAt: 20 }],
    ]);

    const nextCache = remapCachedNoteContents(cache, (path) =>
      path.startsWith('docs/') ? path.replace('docs/', 'archive/') : path
    );

    expect(nextCache.get('archive/alpha.md')).toEqual({ content: '# Alpha', modifiedAt: 10 });
    expect(nextCache.get('archive/beta.md')).toEqual({ content: '# Beta', modifiedAt: 20 });
  });

  it('prunes matching paths', () => {
    const cache = new Map([
      ['docs/alpha.md', { content: '# Alpha', modifiedAt: 10 }],
      ['docs/archive/beta.md', { content: '# Beta', modifiedAt: 20 }],
    ]);

    const nextCache = pruneCachedNoteContents(cache, (path) => path.startsWith('docs/archive/'));

    expect(nextCache.has('docs/alpha.md')).toBe(true);
    expect(nextCache.has('docs/archive/beta.md')).toBe(false);
  });

  it('removes one cached note entry', () => {
    const cache = new Map([
      ['docs/alpha.md', { content: '# Alpha', modifiedAt: 10 }],
    ]);

    const nextCache = removeCachedNoteContent(cache, 'docs/alpha.md');

    expect(nextCache.has('docs/alpha.md')).toBe(false);
  });
});
