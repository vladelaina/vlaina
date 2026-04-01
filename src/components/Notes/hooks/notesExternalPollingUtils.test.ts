import { describe, expect, it } from 'vitest';
import type { FileTreeNode } from '@/stores/notes/types';
import { detectExternalTreePathChanges } from './notesExternalPollingUtils';

function file(path: string): FileTreeNode {
  const segments = path.split('/');
  return {
    id: path,
    path,
    name: segments[segments.length - 1].replace(/\.md$/i, ''),
    isFolder: false,
  };
}

function folder(path: string, children: FileTreeNode[] = []): FileTreeNode {
  const segments = path.split('/');
  return {
    id: path,
    path,
    name: segments[segments.length - 1] ?? '',
    isFolder: true,
    children,
    expanded: true,
  };
}

describe('notesExternalPollingUtils', () => {
  it('detects folder renames with descendants', () => {
    const previous = [
      folder('docs', [folder('docs/guide', [file('docs/guide/intro.md')])]),
    ];
    const next = [
      folder('docs', [folder('docs/tutorial', [file('docs/tutorial/intro.md')])]),
    ];

    expect(detectExternalTreePathChanges(previous, next)).toEqual({
      renames: [{ oldPath: 'docs/guide', newPath: 'docs/tutorial' }],
      deletions: [],
      hasAdditions: false,
      hasChanges: true,
    });
  });

  it('detects file renames inside the same parent folder', () => {
    const previous = [folder('docs', [file('docs/alpha.md')])];
    const next = [folder('docs', [file('docs/beta.md')])];

    expect(detectExternalTreePathChanges(previous, next)).toEqual({
      renames: [{ oldPath: 'docs/alpha.md', newPath: 'docs/beta.md' }],
      deletions: [],
      hasAdditions: false,
      hasChanges: true,
    });
  });

  it('collapses nested deletions to the top-level removed folder', () => {
    const previous = [folder('docs', [folder('docs/guide', [file('docs/guide/intro.md')])])];
    const next = [];

    expect(detectExternalTreePathChanges(previous, next)).toEqual({
      renames: [],
      deletions: ['docs'],
      hasAdditions: false,
      hasChanges: true,
    });
  });

  it('marks new files as additions that require a tree reload', () => {
    const previous = [folder('docs', [file('docs/alpha.md')])];
    const next = [folder('docs', [file('docs/alpha.md'), file('docs/beta.md')])];

    expect(detectExternalTreePathChanges(previous, next)).toEqual({
      renames: [],
      deletions: [],
      hasAdditions: true,
      hasChanges: true,
    });
  });
});
