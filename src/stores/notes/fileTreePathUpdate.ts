import type { FileTreeNode } from './types';

function remapPathWithinBase(path: string, oldBasePath: string, newBasePath: string): string {
  if (path === oldBasePath) {
    return newBasePath;
  }

  if (path.startsWith(`${oldBasePath}/`)) {
    return `${newBasePath}${path.slice(oldBasePath.length)}`;
  }

  return path;
}

export function deepUpdateNodePath(
  node: FileTreeNode,
  oldBasePath: string,
  newBasePath: string
): FileTreeNode {
  const clonedNodes = new Map<FileTreeNode, FileTreeNode>();
  const stack: Array<{ node: FileTreeNode; nextChildIndex: number }> = [{ node, nextChildIndex: 0 }];

  while (stack.length > 0) {
    const frame = stack[stack.length - 1];
    const current = frame.node;
    if (!current.isFolder) {
      const newPath = remapPathWithinBase(current.path, oldBasePath, newBasePath);
      clonedNodes.set(current, { ...current, id: newPath, path: newPath });
      stack.pop();
      continue;
    }

    const pendingChild = current.children[frame.nextChildIndex];
    if (pendingChild) {
      frame.nextChildIndex += 1;
      if (!clonedNodes.has(pendingChild)) {
        stack.push({ node: pendingChild, nextChildIndex: 0 });
      }
      continue;
    }

    const newPath = remapPathWithinBase(current.path, oldBasePath, newBasePath);
    clonedNodes.set(current, {
      ...current,
      id: newPath,
      path: newPath,
      children: current.children.map((child) => clonedNodes.get(child)!),
    });
    stack.pop();
  }

  return clonedNodes.get(node) ?? node;
}
