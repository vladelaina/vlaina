import { describe, expect, it } from 'vitest';
import type { FileTreeNode } from '@/stores/notes/types';
import { collectNotePathsInTreeOrder } from './noteTreeNavigation';

function file(path: string): FileTreeNode {
  return {
    id: path,
    name: path.split('/').pop()?.replace(/\.md$/i, '') || path,
    path,
    isFolder: false,
  };
}

function folder(path: string, children: FileTreeNode[] = []): FileTreeNode {
  return {
    id: path,
    name: path.split('/').pop() || path,
    path,
    isFolder: true,
    children,
    expanded: true,
  };
}

function deepTree(depth: number): FileTreeNode[] {
  let current = file(`folder-${depth}/leaf.md`);

  for (let index = depth; index >= 0; index -= 1) {
    current = folder(`folder-${index}`, [current]);
  }

  return [current];
}

describe('noteTreeNavigation', () => {
  it('collects note paths in tree order', () => {
    expect(collectNotePathsInTreeOrder([
      folder('docs', [
        file('docs/alpha.md'),
        folder('docs/guides', [file('docs/guides/beta.md')]),
      ]),
      file('root.md'),
    ])).toEqual([
      'docs/alpha.md',
      'docs/guides/beta.md',
      'root.md',
    ]);
  });

  it('ignores non-Markdown file tree nodes', () => {
    expect(collectNotePathsInTreeOrder([
      file('asset.png'),
      file('guide.markdown'),
      file('draft.txt'),
      file('reference.mkd'),
    ])).toEqual([
      'guide.markdown',
      'reference.mkd',
    ]);
  });

  it('ignores unsafe and internal markdown paths', () => {
    expect(collectNotePathsInTreeOrder([
      file('../secret.md'),
      file('/tmp/outside.md'),
      file('.git/config.md'),
      file('.vlaina/cache.md'),
      file('./docs//safe.md'),
    ])).toEqual([
      'docs/safe.md',
    ]);
  });

  it('does not spend the navigation scan budget on non-markdown siblings before markdown notes', () => {
    expect(collectNotePathsInTreeOrder([
      file('early.md'),
      ...Array.from({ length: 19_999 }, (_value, index) => file(`asset-${index}.png`)),
      file('late.md'),
    ])).toEqual([
      'early.md',
      'late.md',
    ]);
  });

  it('collects note paths from deep trees without recursive traversal', () => {
    expect(collectNotePathsInTreeOrder(deepTree(2500))).toEqual(['folder-2500/leaf.md']);
  });
});
