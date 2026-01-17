/**
 * Notes Store - File tree utility functions
 * 
 * Cross-platform file tree operations using StorageAdapter
 */

import { getStorageAdapter, joinPath } from '@/lib/storage/adapter';
import type { FileTreeNode } from './types';

/**
 * Build file tree from filesystem
 */
export async function buildFileTree(basePath: string, relativePath: string = ''): Promise<FileTreeNode[]> {
  const storage = getStorageAdapter();
  const fullPath = relativePath ? await joinPath(basePath, relativePath) : basePath;
  const entries = await storage.listDir(fullPath);

  const nodes: FileTreeNode[] = [];

  for (const entry of entries) {
    // Skip hidden folders (like .nekotick)
    if (entry.name.startsWith('.')) continue;

    const entryPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;

    // Check if entry is a directory (handle potential undefined values)
    const isDir = entry.isDirectory === true;
    const isFile = entry.isFile === true;

    if (isDir) {
      const children = await buildFileTree(basePath, entryPath);
      nodes.push({
        id: entryPath,
        name: entry.name,
        path: entryPath,
        isFolder: true,
        children,
        expanded: false,
      });
    } else if (isFile && entry.name.toLowerCase().endsWith('.md')) {
      nodes.push({
        id: entryPath,
        name: entry.name.replace(/\.md$/i, ''),
        path: entryPath,
        isFolder: false,
      });
    }
  }

  return sortFileTree(nodes);
}

/**
 * Sort file tree nodes (folders first, then alphabetically)
 */
export function sortFileTree(nodes: FileTreeNode[]): FileTreeNode[] {
  return [...nodes].sort((a, b) => {
    if (a.isFolder && !b.isFolder) return -1;
    if (!a.isFolder && b.isFolder) return 1;
    return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
  });
}

/**
 * Update a file node's path in the tree
 */
export function updateFileNodePath(
  nodes: FileTreeNode[],
  oldPath: string,
  newPath: string,
  newName: string
): FileTreeNode[] {
  return nodes.map(node => {
    if (node.isFolder) {
      return { ...node, children: updateFileNodePath(node.children, oldPath, newPath, newName) };
    }
    if (node.path === oldPath) {
      return { ...node, id: newPath, path: newPath, name: newName };
    }
    return node;
  });
}

/**
 * Update a folder node and all its children to reflect a rename/move
 */
export function updateFolderNode(
  nodes: FileTreeNode[],
  targetPath: string,
  newName: string,
  newPath: string
): FileTreeNode[] {
  return nodes.map(node => {
    if (node.path === targetPath && node.isFolder) {
      const updateChildPaths = (
        children: FileTreeNode[],
        oldBasePath: string,
        newBasePath: string
      ): FileTreeNode[] => {
        return children.map(child => {
          const newChildPath = child.path.replace(oldBasePath, newBasePath);
          if (child.isFolder) {
            return {
              ...child,
              id: newChildPath,
              path: newChildPath,
              children: updateChildPaths(child.children, oldBasePath, newBasePath),
            };
          }
          return { ...child, id: newChildPath, path: newChildPath };
        });
      };
      return {
        ...node,
        id: newPath,
        name: newName,
        path: newPath,
        children: updateChildPaths(node.children, targetPath, newPath),
      };
    }
    if (node.isFolder) {
      return { ...node, children: updateFolderNode(node.children, targetPath, newName, newPath) };
    }
    return node;
  });
}

/**
 * Toggle folder expanded state
 */
export function updateFolderExpanded(nodes: FileTreeNode[], targetPath: string): FileTreeNode[] {
  return nodes.map(node => {
    if (node.isFolder) {
      if (node.path === targetPath) {
        return { ...node, expanded: !node.expanded };
      }
      return { ...node, children: updateFolderExpanded(node.children, targetPath) };
    }
    return node;
  });
}

/**
 * Collect all expanded folder paths
 */
export function collectExpandedPaths(nodes: FileTreeNode[]): Set<string> {
  const expandedPaths = new Set<string>();
  const collect = (nodes: FileTreeNode[]) => {
    for (const node of nodes) {
      if (node.isFolder) {
        if (node.expanded) {
          expandedPaths.add(node.path);
        }
        collect(node.children);
      }
    }
  };
  collect(nodes);
  return expandedPaths;
}

/**
 * Restore expanded state from saved paths
 */
export function restoreExpandedState(
  nodes: FileTreeNode[],
  expandedPaths: Set<string>
): FileTreeNode[] {
  return nodes.map(node => {
    if (node.isFolder) {
      return {
        ...node,
        expanded: expandedPaths.has(node.path),
        children: restoreExpandedState(node.children, expandedPaths),
      };
    }
    return node;
  });
}

/**
 * Add a new node to the tree at the specified folder path
 * If targetFolderPath is undefined/empty, adds to the root level (top of the nodes array)
 */
export function addNodeToTree(
  nodes: FileTreeNode[],
  targetFolderPath: string | undefined | null,
  newNode: FileTreeNode
): FileTreeNode[] {
  // If no target folder (root), just add and sort
  if (!targetFolderPath) {
    return sortFileTree([...nodes, newNode]);
  }

  return nodes.map(node => {
    if (node.isFolder) {
      if (node.path === targetFolderPath) {
        // Found the parent folder, add child and sort
        return {
          ...node,
          children: sortFileTree([...node.children, newNode]),
          expanded: true // Auto-expand parent when adding child
        };
      }
      // Continue searching recursively
      return {
        ...node,
        children: addNodeToTree(node.children, targetFolderPath, newNode)
      };
    }
    return node;
  });
}

/**
 * Remove a node from the tree by path
 */
export function removeNodeFromTree(
  nodes: FileTreeNode[],
  targetPath: string
): FileTreeNode[] {
  return nodes.filter(node => node.path !== targetPath).map(node => {
    if (node.isFolder) {
      return {
        ...node,
        children: removeNodeFromTree(node.children, targetPath)
      };
    }
    return node;
  });
}

/**
 * Find a node in the tree by path
 */
export function findNode(nodes: FileTreeNode[], targetPath: string): FileTreeNode | null {
  for (const node of nodes) {
    if (node.path === targetPath) return node;
    if (node.isFolder) {
      const found = findNode(node.children, targetPath);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Deep update paths for a node and its children (used when moving a folder)
 */
export function deepUpdateNodePath(
  node: FileTreeNode,
  oldBasePath: string,
  newBasePath: string
): FileTreeNode {
  const newPath = node.path === oldBasePath
    ? newBasePath
    : node.path.replace(oldBasePath, newBasePath);

  const newNode = {
    ...node,
    id: newPath,
    path: newPath,
    children: node.isFolder
      ? node.children.map(child => deepUpdateNodePath(child, oldBasePath, newBasePath))
      : [],
  };
  return newNode;
}
