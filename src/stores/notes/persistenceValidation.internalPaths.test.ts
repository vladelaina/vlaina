import { describe, expect, it } from 'vitest';
import {
  MAX_RECENT_NOTE_PATH_SCAN_ITEMS,
  MAX_WORKSPACE_EXPANDED_FOLDER_SCAN_ITEMS,
  normalizeRecentNotePaths,
  normalizeWorkspaceState,
} from './persistenceValidation';

describe('notes persistence internal path validation', () => {
  it('keeps user dot Markdown paths while dropping internal recent notes', () => {
    expect(normalizeRecentNotePaths([
      'docs/alpha.md',
      '.journal.md',
      '.notes/alpha.md',
      '.vlaina/workspace.md',
      'docs/.git/config.md',
      '.VLAINA/workspace.md',
      'docs/.GIT/config.md',
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
      expandedFolders: ['docs', '.notes', '.vlaina', 'docs/.git', '.VLAINA', 'docs/.GIT', '../escape'],
      fileTreeSortMode: 'name-asc',
    })).toEqual({
      currentNotePath: null,
      expandedFolders: ['docs', '.notes'],
      fileTreeSortMode: 'name-asc',
    });
  });

  it('drops case-variant internal workspace current note paths', () => {
    expect(normalizeWorkspaceState({
      currentNotePath: 'docs/.GIT/config.md',
      expandedFolders: [],
      fileTreeSortMode: 'name-asc',
    })?.currentNotePath).toBeNull();
  });

  it('bounds recent note path scans before accepting later valid paths', () => {
    expect(normalizeRecentNotePaths([
      ...Array.from({ length: MAX_RECENT_NOTE_PATH_SCAN_ITEMS }, (_, index) => `image-${index}.png`),
      'docs/after-limit.md',
    ])).toEqual([]);
  });

  it('bounds workspace expanded folder scans before accepting later valid paths', () => {
    expect(normalizeWorkspaceState({
      currentNotePath: null,
      expandedFolders: [
        ...Array.from({ length: MAX_WORKSPACE_EXPANDED_FOLDER_SCAN_ITEMS }, (_, index) => `../escape-${index}`),
        'docs',
      ],
      fileTreeSortMode: 'name-asc',
    })).toEqual({
      currentNotePath: null,
      expandedFolders: [],
      fileTreeSortMode: 'name-asc',
    });
  });
});
