import { describe, expect, it } from 'vitest';
import type { FileTreeNode } from './types';
import {
  addNodeToTree,
  collectExpandedPaths,
  deepUpdateNodePath,
  expandFoldersForPath,
  removeNodeFromTree,
  restoreExpandedState,
  updateFileNodePath,
  updateFolderExpanded,
  updateFolderNode,
} from './fileTreeUtils';

function createDeepTree(depth: number): FileTreeNode[] {
  const leafParentPath = Array.from(
    { length: depth + 1 },
    (_, index) => `folder-${index}`,
  ).join('/');
  let current: FileTreeNode = {
    id: `${leafParentPath}/leaf.md`,
    name: 'leaf',
    path: `${leafParentPath}/leaf.md`,
    isFolder: false,
  };

  for (let index = depth; index >= 0; index -= 1) {
    const path = Array.from(
      { length: index + 1 },
      (_, pathIndex) => `folder-${pathIndex}`,
    ).join('/');
    current = {
      id: path,
      name: `folder-${index}`,
      path,
      isFolder: true,
      expanded: false,
      children: [current],
    };
  }

  return [current];
}

describe('fileTreeUtils deep updates', () => {
  it('updates deep file paths without recursive traversal', () => {
    const tree = createDeepTree(2500);
    const oldPath = `${Array.from({ length: 2501 }, (_, index) => `folder-${index}`).join('/')}/leaf.md`;
    const newPath = `${Array.from({ length: 2501 }, (_, index) => `folder-${index}`).join('/')}/renamed.md`;
    const nextTree = updateFileNodePath(
      tree,
      oldPath,
      newPath,
      'renamed',
    );

    let cursor = nextTree[0];
    while (cursor.isFolder) {
      cursor = cursor.children[0];
    }

    expect(cursor).toMatchObject({
      path: newPath,
      name: 'renamed',
    });
  });

  it('toggles and expands deep folders without recursive traversal', () => {
    const tree = createDeepTree(2500);
    const targetFolderPath = Array.from({ length: 2501 }, (_, index) => `folder-${index}`).join('/');
    const leafPath = `${targetFolderPath}/leaf.md`;
    const toggledTree = updateFolderExpanded(tree, targetFolderPath);
    const expandedTree = expandFoldersForPath(tree, leafPath);

    expect(collectExpandedPaths(toggledTree).has(targetFolderPath)).toBe(true);
    expect(collectExpandedPaths(expandedTree).has(targetFolderPath)).toBe(true);
  });

  it('adds and removes deep children without recursive traversal', () => {
    const tree = createDeepTree(2500);
    const targetFolderPath = Array.from({ length: 2501 }, (_, index) => `folder-${index}`).join('/');
    const newPath = `${targetFolderPath}/new.md`;
    const addedTree = addNodeToTree(tree, targetFolderPath, {
      id: newPath,
      name: 'new',
      path: newPath,
      isFolder: false,
    });
    const removedTree = removeNodeFromTree(addedTree, newPath);

    let addedCursor = addedTree[0];
    let removedCursor = removedTree[0];
    while (addedCursor.isFolder && addedCursor.path !== targetFolderPath) {
      addedCursor = addedCursor.children[0];
    }
    while (removedCursor.isFolder && removedCursor.path !== targetFolderPath) {
      removedCursor = removedCursor.children[0];
    }

    expect(addedCursor.isFolder ? addedCursor.children.map((child) => child.path) : []).toContain(newPath);
    expect(removedCursor.isFolder ? removedCursor.children.map((child) => child.path) : []).not.toContain(newPath);
  });

  it('renames deep folder subtrees without recursive traversal', () => {
    const tree = createDeepTree(2500);
    const targetFolderPath = Array.from({ length: 2501 }, (_, index) => `folder-${index}`).join('/');
    const targetParentPath = Array.from({ length: 2500 }, (_, index) => `folder-${index}`).join('/');
    const renamedFolderPath = `${targetParentPath}/renamed-folder`;
    const renamedTree = updateFolderNode(tree, targetFolderPath, 'renamed-folder', renamedFolderPath);

    let cursor = renamedTree[0];
    while (cursor.isFolder && cursor.path !== renamedFolderPath) {
      cursor = cursor.children[0];
    }

    expect(cursor).toMatchObject({
      isFolder: true,
      path: renamedFolderPath,
      name: 'renamed-folder',
    });
    expect(cursor.isFolder ? cursor.children[0]?.path : '').toBe(`${renamedFolderPath}/leaf.md`);
  });

  it('restores expanded state and deep-updates node paths without recursive traversal', () => {
    const tree = createDeepTree(2500);
    const targetFolderPath = Array.from({ length: 2501 }, (_, index) => `folder-${index}`).join('/');
    const expanded = restoreExpandedState(tree, new Set(['folder-0', targetFolderPath]));
    const updated = deepUpdateNodePath(expanded[0], 'folder-0', 'renamed-root');

    expect(collectExpandedPaths(expanded)).toEqual(new Set(['folder-0', targetFolderPath]));
    expect(updated.path).toBe('renamed-root');
    const expectedLeafPath = `${[
      'renamed-root',
      ...Array.from({ length: 2500 }, (_, index) => `folder-${index + 1}`),
      'leaf.md',
    ].join('/')}`;
    let cursor = updated;
    while (cursor.isFolder) {
      if (cursor.children[0]?.path === expectedLeafPath) {
        break;
      }
      cursor = cursor.children[0];
    }
    expect(cursor.isFolder ? cursor.children[0]?.path : '').toBe(expectedLeafPath);
  });
});
