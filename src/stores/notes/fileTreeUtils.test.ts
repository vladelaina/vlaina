import { describe, expect, it } from 'vitest';
import type { FileTreeNode } from './types';
import {
  addNodeToTree,
  expandFoldersForPath,
  removeNodeFromTree,
  updateFolderExpanded,
} from './fileTreeUtils';

function createTree(): FileTreeNode[] {
  return [
    {
      id: 'docs',
      name: 'docs',
      path: 'docs',
      isFolder: true,
      expanded: false,
      children: [
        {
          id: 'docs/guides',
          name: 'guides',
          path: 'docs/guides',
          isFolder: true,
          expanded: false,
          children: [
            {
              id: 'docs/guides/intro.md',
              name: 'intro',
              path: 'docs/guides/intro.md',
              isFolder: false,
            },
          ],
        },
      ],
    },
    {
      id: 'archive',
      name: 'archive',
      path: 'archive',
      isFolder: true,
      expanded: false,
      children: [
        {
          id: 'archive/old.md',
          name: 'old',
          path: 'archive/old.md',
          isFolder: false,
        },
      ],
    },
  ];
}

describe('fileTreeUtils structural sharing', () => {
  it('toggles only the targeted folder route', () => {
    const tree = createTree();
    const nextTree = updateFolderExpanded(tree, 'docs/guides');

    expect(nextTree).not.toBe(tree);
    expect(nextTree[0]).not.toBe(tree[0]);
    expect(nextTree[1]).toBe(tree[1]);
    expect((nextTree[0] as Extract<FileTreeNode, { isFolder: true }>).children[0]).not.toBe(
      (tree[0] as Extract<FileTreeNode, { isFolder: true }>).children[0],
    );
  });

  it('expands only the active path ancestors', () => {
    const tree = createTree();
    const nextTree = expandFoldersForPath(tree, 'docs/guides/intro.md');

    expect(nextTree[0]).not.toBe(tree[0]);
    expect(nextTree[1]).toBe(tree[1]);
    expect((nextTree[0] as Extract<FileTreeNode, { isFolder: true }>).expanded).toBe(true);
    expect(
      ((nextTree[0] as Extract<FileTreeNode, { isFolder: true }>).children[0] as Extract<
        FileTreeNode,
        { isFolder: true }
      >).expanded,
    ).toBe(true);
  });

  it('adds and removes nodes without rebuilding untouched siblings', () => {
    const tree = createTree();
    const addedTree = addNodeToTree(tree, 'docs/guides', {
      id: 'docs/guides/new.md',
      name: 'new',
      path: 'docs/guides/new.md',
      isFolder: false,
    });
    const removedTree = removeNodeFromTree(addedTree, 'docs/guides/new.md');

    expect(addedTree[1]).toBe(tree[1]);
    expect(removedTree[1]).toBe(tree[1]);
    expect(
      (((addedTree[0] as Extract<FileTreeNode, { isFolder: true }>).children[0] as Extract<
        FileTreeNode,
        { isFolder: true }
      >).children.length),
    ).toBe(2);
    expect(
      (((removedTree[0] as Extract<FileTreeNode, { isFolder: true }>).children[0] as Extract<
        FileTreeNode,
        { isFolder: true }
      >).children.length),
    ).toBe(1);
  });
});
