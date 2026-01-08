/** Notes Store - File tree utility functions */

import { readDir } from '@tauri-apps/plugin-fs';
import { join } from '@tauri-apps/api/path';
import type { FileTreeNode } from './types';

/**
 * Build file tree from filesystem
 */
export async function buildFileTree(basePath: string, relativePath: string = ''): Promise<FileTreeNode[]> {
  const fullPath = relativePath ? await join(basePath, relativePath) : basePath;
  const entries = await readDir(fullPath);

  const nodes: FileTreeNode[] = [];

  for (const entry of entries) {
    // Skip hidden folders (like .nekotick)
    if (entry.name.startsWith('.')) continue;

    const entryPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;

    if (entry.isDirectory) {
      const children = await buildFileTree(basePath, entryPath);
      nodes.push({
        id: entryPath,
        name: entry.name,
        path: entryPath,
        isFolder: true,
        children,
        expanded: false,
      });
    } else if (entry.name.endsWith('.md')) {
      nodes.push({
        id: entryPath,
        name: entry.name.replace(/\.md$/, ''),
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
export function updateFolderNode(nodes: FileTreeNode[], targetPath: string, newName: string, newPath: string): FileTreeNode[] {
  return nodes.map(node => {
    if (node.path === targetPath && node.isFolder) {
      const updateChildPaths = (children: FileTreeNode[], oldBasePath: string, newBasePath: string): FileTreeNode[] => {
        return children.map(child => {
          const newChildPath = child.path.replace(oldBasePath, newBasePath);
          if (child.isFolder) {
            return { ...child, id: newChildPath, path: newChildPath, children: updateChildPaths(child.children, oldBasePath, newBasePath) };
          }
          return { ...child, id: newChildPath, path: newChildPath };
        });
      };
      return { ...node, id: newPath, name: newName, path: newPath, children: updateChildPaths(node.children, targetPath, newPath) };
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
export function restoreExpandedState(nodes: FileTreeNode[], expandedPaths: Set<string>): FileTreeNode[] {
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
