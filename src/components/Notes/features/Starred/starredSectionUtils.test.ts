import { describe, expect, it } from 'vitest';
import type { FileTreeNode, FolderNode } from '@/stores/notes/types';
import { buildNodeLookup } from './starredSectionUtils';

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

function root(children: FileTreeNode[]): FolderNode {
  return {
    id: '',
    name: 'root',
    path: '',
    isFolder: true,
    expanded: true,
    children,
  };
}

function deepRoot(depth: number): FolderNode {
  let current = file(`folder-${depth}/leaf.md`);

  for (let index = depth; index >= 0; index -= 1) {
    current = folder(`folder-${index}`, [current]);
  }

  return root([current]);
}

describe('starredSectionUtils', () => {
  it('builds a node lookup in tree order', () => {
    const lookup = buildNodeLookup(root([
      folder('docs', [
        file('docs/alpha.md'),
        folder('docs/guides', [file('docs/guides/beta.md')]),
      ]),
      file('root.md'),
    ]));

    expect(Array.from(lookup.keys())).toEqual([
      'docs',
      'docs/alpha.md',
      'docs/guides',
      'docs/guides/beta.md',
      'root.md',
    ]);
  });

  it('builds a node lookup from deep trees without recursive traversal', () => {
    const lookup = buildNodeLookup(deepRoot(2500));

    expect(lookup.get('folder-2500/leaf.md')).toMatchObject({
      isFolder: false,
      path: 'folder-2500/leaf.md',
    });
  });
});
