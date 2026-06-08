import { describe, expect, it } from 'vitest';
import { normalizeRecentNotePaths, normalizeWorkspaceState } from './persistenceValidation';

describe('notes persistence internal path validation', () => {
  it('keeps user dot Markdown paths while dropping internal recent notes', () => {
    expect(normalizeRecentNotePaths([
      'docs/alpha.md',
      '.journal.md',
      '.notes/alpha.md',
      '.vlaina/workspace.md',
      'docs/.git/config.md',
      'image.png',
    ])).toEqual([
      'docs/alpha.md',
      '.journal.md',
      '.notes/alpha.md',
    ]);
  });

  it('drops internal workspace paths while keeping user dot folders', () => {
    expect(normalizeWorkspaceState({
      currentNotePath: '.vlaina/workspace.md',
      expandedFolders: ['docs', '.notes', '.vlaina', 'docs/.git', '../escape'],
      fileTreeSortMode: 'name-asc',
    })).toEqual({
      currentNotePath: null,
      expandedFolders: ['docs', '.notes'],
      fileTreeSortMode: 'name-asc',
    });
  });
});
