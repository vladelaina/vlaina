import {
  CLOUD_FOLDER_KEEP_FILE,
  getCloudBaseName,
  normalizeCloudRelativePath,
} from '../pathOperations';
import type { CloudRepoNode } from '../types';

function compareNodes(a: CloudRepoNode, b: CloudRepoNode): number {
  if (a.kind !== b.kind) {
    return a.kind === 'folder' ? -1 : 1;
  }
  return a.name.localeCompare(b.name);
}

export function isVisibleMarkdownFile(path: string): boolean {
  return path.toLowerCase().endsWith('.md');
}

export function isFolderPlaceholder(path: string): boolean {
  return getCloudBaseName(path) === CLOUD_FOLDER_KEEP_FILE;
}

export function sortTree(nodes: CloudRepoNode[]): CloudRepoNode[] {
  return nodes
    .map((node) => ({
      ...node,
      children: node.children ? sortTree(node.children) : undefined,
    }))
    .sort(compareNodes);
}

export function buildExpandedSet(
  nodes: CloudRepoNode[],
  expanded = new Set<string>()
): Set<string> {
  for (const node of nodes) {
    if (node.kind === 'folder') {
      if (node.expanded) {
        expanded.add(node.path);
      }
      if (node.children?.length) {
        buildExpandedSet(node.children, expanded);
      }
    }
  }
  return expanded;
}

export function findFolderNode(
  nodes: CloudRepoNode[],
  targetPath: string
): CloudRepoNode | null {
  for (const node of nodes) {
    if (node.kind !== 'folder') continue;
    if (node.path === targetPath) return node;
    if (node.children?.length) {
      const child = findFolderNode(node.children, targetPath);
      if (child) return child;
    }
  }
  return null;
}

export function ensureFolder(
  roots: CloudRepoNode[],
  targetPath: string,
  expandedPaths: Set<string>
): CloudRepoNode {
  const normalizedPath = normalizeCloudRelativePath(targetPath);
  const parts = normalizedPath.split('/').filter(Boolean);

  let siblings = roots;
  let currentPath = '';
  let currentNode: CloudRepoNode | null = null;

  for (const part of parts) {
    currentPath = currentPath ? `${currentPath}/${part}` : part;
    let existing = siblings.find(
      (node) => node.kind === 'folder' && node.path === currentPath
    );

    if (!existing) {
      existing = {
        path: currentPath,
        name: part,
        kind: 'folder',
        sha: null,
        expanded: expandedPaths.has(currentPath),
        children: [],
      };
      siblings.push(existing);
    }

    if (!existing.children) {
      existing.children = [];
    }

    currentNode = existing;
    siblings = existing.children;
  }

  if (!currentNode) {
    throw new Error('Failed to ensure cloud folder node');
  }

  return currentNode;
}
