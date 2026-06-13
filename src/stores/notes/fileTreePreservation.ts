import { getNoteTitleFromPath } from '@/lib/notes/displayName';
import { isSupportedMarkdownPath } from '@/lib/notes/markdownFile';
import { sortFileTree } from './fileTreeSorting';
import { findNode } from './fileTreeUtils';
import type { FileTreeNode } from './types';
import { hasInternalNotePathSegment } from './utils/fs/internalNotePaths';
import { normalizeVaultRelativePath } from './utils/fs/vaultPathContainment';

function buildMissingPathChain(pathSegments: string[], fullPath: string, parentPath: string): FileTreeNode {
  let current: FileTreeNode = {
    id: fullPath,
    name: getNoteTitleFromPath(fullPath),
    path: fullPath,
    isFolder: false,
  };
  const folderPaths: string[] = [];
  let currentParentPath = parentPath;

  for (let index = 0; index < pathSegments.length - 1; index += 1) {
    const segment = pathSegments[index];
    currentParentPath = currentParentPath ? `${currentParentPath}/${segment}` : segment;
    folderPaths.push(currentParentPath);
  }

  for (let index = pathSegments.length - 2; index >= 0; index -= 1) {
    const segment = pathSegments[index];
    const nodePath = folderPaths[index];
    current = {
      id: nodePath,
      name: segment,
      path: nodePath,
      isFolder: true,
      children: [current],
      expanded: true,
    };
  }

  return current;
}

export function ensureFileNodeInTree(nodes: FileTreeNode[], path: string): FileTreeNode[] {
  const normalizedPath = normalizeVaultRelativePath(path);
  if (!normalizedPath || hasInternalNotePathSegment(normalizedPath) || !isSupportedMarkdownPath(normalizedPath)) {
    return nodes;
  }

  if (findNode(nodes, normalizedPath)) {
    return nodes;
  }

  const pathSegments = normalizedPath.split('/').filter(Boolean);
  if (pathSegments.length === 0) {
    return nodes;
  }

  const ancestors: Array<{
    index: number;
    nodes: FileTreeNode[];
    node: Extract<FileTreeNode, { isFolder: true }>;
  }> = [];
  let currentNodes = nodes;
  let parentPath = '';
  let segmentIndex = 0;

  while (segmentIndex < pathSegments.length - 1) {
    const segment = pathSegments[segmentIndex];
    const folderPath = parentPath ? `${parentPath}/${segment}` : segment;
    const folderIndex = currentNodes.findIndex((node) => node.isFolder && node.path === folderPath);
    if (folderIndex === -1) {
      break;
    }

    const folder = currentNodes[folderIndex];
    if (!folder.isFolder) {
      break;
    }

    ancestors.push({ index: folderIndex, nodes: currentNodes, node: folder });
    currentNodes = folder.children;
    parentPath = folderPath;
    segmentIndex += 1;
  }

  const remainingSegments = pathSegments.slice(segmentIndex);
  const insertedNode = remainingSegments.length === 1
    ? {
        id: normalizedPath,
        name: getNoteTitleFromPath(normalizedPath),
        path: normalizedPath,
        isFolder: false as const,
      }
    : buildMissingPathChain(remainingSegments, normalizedPath, parentPath);
  let nextNodes = sortFileTree([...currentNodes, insertedNode]);

  for (let index = ancestors.length - 1; index >= 0; index -= 1) {
    const ancestor = ancestors[index];
    const nextFolder = {
      ...ancestor.node,
      expanded: true,
      children: nextNodes,
    };
    nextNodes = ancestor.nodes.map((node, nodeIndex) => (
      nodeIndex === ancestor.index ? nextFolder : node
    ));
  }

  return nextNodes;
}
