import { describe, expect, it } from 'vitest';

import {
  getNotesSidebarContentMatches,
  MAX_CONTENT_SEARCH_HTML_RANGES,
} from './notesSidebarContentSearch';

describe('notesSidebarContentSearch', () => {
  it('bounds skipped HTML ranges while searching note content', () => {
    const hiddenBlocks = Array.from(
      { length: MAX_CONTENT_SEARCH_HTML_RANGES + 100 },
      (_, index) => `<svg>hidden ${index}</svg>`,
    ).join('\n');
    const content = `${hiddenBlocks}\nvisible target`;

    const matches = getNotesSidebarContentMatches(content, 'target');

    expect(matches).toHaveLength(1);
    expect(matches[0]?.snippet).toBe('visible target');
  });
});
