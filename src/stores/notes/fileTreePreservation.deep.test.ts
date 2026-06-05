import { describe, expect, it } from 'vitest';
import { ensureFileNodeInTree } from './fileTreePreservation';
import type { FileTreeNode } from './types';

function createDeepPath(depth: number) {
  return [
    ...Array.from({ length: depth }, (_, index) => `folder-${index}`),
    'leaf.md',
  ].join('/');
}

describe('fileTreePreservation deep paths', () => {
  it('adds a missing deep file path without recursive traversal', () => {
    const path = createDeepPath(2500);
    const tree = ensureFileNodeInTree([], path);

    let cursor: FileTreeNode | undefined = tree[0];
    while (cursor?.isFolder) {
      cursor = cursor.children[0];
    }

    expect(cursor).toMatchObject({
      isFolder: false,
      path,
      name: 'leaf',
    });
  });

  it('expands an existing deep folder route without recursive traversal', () => {
    const existingPath = createDeepPath(1200);
    const insertedPath = existingPath.replace('leaf.md', 'nested/leaf.md');
    const existingTree = ensureFileNodeInTree([], existingPath);
    const nextTree = ensureFileNodeInTree(existingTree, insertedPath);

    let cursor: FileTreeNode | undefined = nextTree[0];
    while (cursor?.isFolder && cursor.path !== insertedPath.replace('/leaf.md', '')) {
      expect(cursor.expanded).toBe(true);
      cursor = cursor.children[0];
    }

    expect(cursor).toMatchObject({
      isFolder: true,
      path: insertedPath.replace('/leaf.md', ''),
      expanded: true,
    });
  });
});
