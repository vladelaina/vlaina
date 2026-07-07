import type { FileTreeNode } from './types';
import { MAX_FILE_TREE_DERIVED_NODES } from './fileTreeLimits';

export function countFileTreeNodes(nodes: readonly FileTreeNode[]) {
  let folders = 0;
  let files = 0;
  const stack = [...nodes].reverse();
  let visitedNodes = 0;

  while (stack.length > 0 && visitedNodes < MAX_FILE_TREE_DERIVED_NODES) {
    const node = stack.pop()!;
    visitedNodes += 1;
    if (node.isFolder) {
      folders += 1;
      for (let index = node.children.length - 1; index >= 0; index -= 1) {
        stack.push(node.children[index]);
      }
    } else {
      files += 1;
    }
  }

  return {
    nodes: folders + files,
    folders,
    files,
  };
}
