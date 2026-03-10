import { getStorageAdapter, joinPath } from '@/lib/storage/adapter';
import type { FileTreeNode } from './types';

export async function buildFileTree(basePath: string, relativePath: string = ''): Promise<FileTreeNode[]> {
  const storage = getStorageAdapter();
  const fullPath = relativePath ? await joinPath(basePath, relativePath) : basePath;
  const entries = await storage.listDir(fullPath);

  const nodes: FileTreeNode[] = [];

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;

    const entryPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;

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

export function sortFileTree(nodes: FileTreeNode[]): FileTreeNode[] {
  return [...nodes].sort((a, b) => {
    if (a.isFolder && !b.isFolder) return -1;
    if (!a.isFolder && b.isFolder) return 1;
    return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
  });
}

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

export function expandFoldersForPath(nodes: FileTreeNode[], targetPath: string): FileTreeNode[] {
  const pathSegments = targetPath.split('/').filter(Boolean);
  const expandedPaths = new Set<string>();

  for (let index = 0; index < pathSegments.length; index += 1) {
    expandedPaths.add(pathSegments.slice(0, index + 1).join('/'));
  }

  return nodes.map((node) => {
    if (!node.isFolder) {
      return node;
    }

    return {
      ...node,
      expanded: node.expanded || expandedPaths.has(node.path),
      children: expandFoldersForPath(node.children, targetPath),
    };
  });
}

export function addNodeToTree(
  nodes: FileTreeNode[],
  targetFolderPath: string | undefined | null,
  newNode: FileTreeNode
): FileTreeNode[] {
  if (!targetFolderPath) {
    return sortFileTree([...nodes, newNode]);
  }

  return nodes.map(node => {
    if (node.isFolder) {
      if (node.path === targetFolderPath) {
        return {
          ...node,
          children: sortFileTree([...node.children, newNode]),
          expanded: true // Auto-expand parent when adding child
        };
      }
      return {
        ...node,
        children: addNodeToTree(node.children, targetFolderPath, newNode)
      };
    }
    return node;
  });
}

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
