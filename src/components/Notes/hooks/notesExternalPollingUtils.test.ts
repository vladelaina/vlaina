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

function deepFolderTree(depth: number, leafPath: string): FileTreeNode[] {
  let current: FileTreeNode = file(leafPath);

  for (let index = depth; index >= 0; index -= 1) {
    current = folder(`folder-${index}`, [current]);
  }

  return [current];
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

  it('detects unique file moves across parent folders', () => {
    const previous = [
      folder('docs', [file('docs/alpha.md')]),
      folder('archive'),
    ];
    const next = [
      folder('docs'),
      folder('archive', [file('archive/alpha.md')]),
    ];

    expect(detectExternalTreePathChanges(previous, next)).toEqual({
      renames: [{ oldPath: 'docs/alpha.md', newPath: 'archive/alpha.md' }],
      deletions: [],
      hasAdditions: false,
      hasChanges: true,
    });
  });

  it('does not infer cross-folder file moves with different names', () => {
    const previous = [
      folder('docs', [file('docs/alpha.md')]),
      folder('archive'),
    ];
    const next = [
      folder('docs'),
      folder('archive', [file('archive/beta.md')]),
    ];

    expect(detectExternalTreePathChanges(previous, next)).toEqual({
      renames: [],
      deletions: ['docs/alpha.md'],
      hasAdditions: true,
      hasChanges: true,
    });
  });

  it('collapses nested deletions to the top-level removed folder', () => {
    const previous = [folder('docs', [folder('docs/guide', [file('docs/guide/intro.md')])])];
    const next: FileTreeNode[] = [];

    expect(detectExternalTreePathChanges(previous, next)).toEqual({
      renames: [],
      deletions: ['docs'],
      hasAdditions: false,
      hasChanges: true,
    });
  });

  it('collapses many nested deletions without changing deletion semantics', () => {
    const previous = [
      folder('docs', Array.from({ length: 1000 }, (_, index) =>
        folder(`docs/section-${index}`, [file(`docs/section-${index}/intro.md`)])
      )),
    ];
    const next: FileTreeNode[] = [];

    expect(detectExternalTreePathChanges(previous, next)).toEqual({
      renames: [],
      deletions: ['docs'],
      hasAdditions: false,
      hasChanges: true,
    });
  });

  it('marks new files as additions that require a tree reload', () => {
    const previous = [folder('docs', [file('docs/alpha.md')])];
    const next: FileTreeNode[] = [folder('docs', [file('docs/alpha.md'), file('docs/beta.md')])];

    expect(detectExternalTreePathChanges(previous, next)).toEqual({
      renames: [],
      deletions: [],
      hasAdditions: true,
      hasChanges: true,
    });
  });

  it('detects deep tree changes without recursive traversal', () => {
    const previous = deepFolderTree(2500, 'folder-2500/alpha.md');
    const next = deepFolderTree(2500, 'folder-2500/beta.md');

    expect(detectExternalTreePathChanges(previous, next)).toMatchObject({
      renames: [{ oldPath: 'folder-2500/alpha.md', newPath: 'folder-2500/beta.md' }],
      hasChanges: true,
    });
  });

  it('does not infer path deletions from truncated tree snapshots', () => {
    const previous = [
      folder('docs', Array.from({ length: 20_050 }, (_, index) => file(`docs/note-${index}.md`))),
    ];
    const next: FileTreeNode[] = [];

    expect(detectExternalTreePathChanges(previous, next)).toEqual({
      renames: [],
      deletions: [],
      hasAdditions: true,
      hasChanges: true,
    });
  });
});
