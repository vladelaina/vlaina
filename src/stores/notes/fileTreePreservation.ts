import { getNoteTitleFromPath } from '@/lib/notes/displayName';
import { sortFileTree } from './fileTreeSorting';
import { findNode } from './fileTreeUtils';
import type { FileTreeNode } from './types';

function buildMissingPathChain(pathSegments: string[], fullPath: string, parentPath: string): FileTreeNode {
  const [segment, ...remainingSegments] = pathSegments;
  const nodePath = parentPath ? `${parentPath}/${segment}` : segment;

  if (remainingSegments.length === 0) {
    return {
      id: fullPath,
      name: getNoteTitleFromPath(fullPath),
      path: fullPath,
      isFolder: false,
    };
  }

  return {
    id: nodePath,
    name: segment,
    path: nodePath,
    isFolder: true,
    children: [buildMissingPathChain(remainingSegments, fullPath, nodePath)],
    expanded: true,
  };
}

export function ensureFileNodeInTree(nodes: FileTreeNode[], path: string): FileTreeNode[] {
  if (findNode(nodes, path)) {
    return nodes;
  }

  const pathSegments = path.split('/').filter(Boolean);
  if (pathSegments.length === 0) {
    return nodes;
  }

  const insert = (
    currentNodes: FileTreeNode[],
    remainingSegments: string[],
    parentPath: string
  ): FileTreeNode[] => {
    const [segment, ...nextSegments] = remainingSegments;
    if (nextSegments.length === 0) {
      return sortFileTree([
        ...currentNodes,
        {
          id: path,
          name: getNoteTitleFromPath(path),
          path,
          isFolder: false as const,
        },
      ]);
    }

    const folderPath = parentPath ? `${parentPath}/${segment}` : segment;
    const folderIndex = currentNodes.findIndex((node) => node.isFolder && node.path === folderPath);
    if (folderIndex === -1) {
      return sortFileTree([
        ...currentNodes,
        buildMissingPathChain(remainingSegments, path, parentPath),
      ]);
    }

    const nextNodes = [...currentNodes];
    const folder = nextNodes[folderIndex];
    if (!folder.isFolder) {
      return currentNodes;
    }

    nextNodes[folderIndex] = {
      ...folder,
      expanded: true,
      children: insert(folder.children, nextSegments, folderPath),
    };

    return nextNodes;
  };

  return insert(nodes, pathSegments, '');
}
