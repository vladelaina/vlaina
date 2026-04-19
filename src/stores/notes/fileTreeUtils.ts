import { getStorageAdapter, joinPath } from '@/lib/storage/adapter';
import type { FileTreeNode } from './types';
import { sortFileTree } from './fileTreeSorting';

export async function buildFileTreeLevel(basePath: string, relativePath: string = ''): Promise<FileTreeNode[]> {
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
      nodes.push({
        id: entryPath,
        name: entry.name,
        path: entryPath,
        isFolder: true,
        children: [],
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

export async function buildFileTree(basePath: string, relativePath: string = ''): Promise<FileTreeNode[]> {
  const nodes = await buildFileTreeLevel(basePath, relativePath);

  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index];
    if (!node.isFolder) {
      continue;
    }

    nodes[index] = {
      ...node,
      children: await buildFileTree(basePath, node.path),
    };
  }

  return sortFileTree(nodes);
}

function isPathOnRoute(nodePath: string, targetPath: string): boolean {
  return targetPath === nodePath || targetPath.startsWith(`${nodePath}/`);
}
export function updateFileNodePath(
  nodes: FileTreeNode[],
  oldPath: string,
  newPath: string,
  newName: string
): FileTreeNode[] {
  let didChange = false;
  const nextNodes = nodes.map(node => {
    if (node.isFolder) {
      if (!isPathOnRoute(node.path, oldPath)) {
        return node;
      }

      const nextChildren = updateFileNodePath(node.children, oldPath, newPath, newName);
      if (nextChildren === node.children) {
        return node;
      }

      didChange = true;
      return { ...node, children: nextChildren };
    }
    if (node.path === oldPath) {
      didChange = true;
      return { ...node, id: newPath, path: newPath, name: newName };
    }
    return node;
  });

  return didChange ? nextNodes : nodes;
}

export function updateFolderNode(
  nodes: FileTreeNode[],
  targetPath: string,
  newName: string,
  newPath: string
): FileTreeNode[] {
  let didChange = false;
  const nextNodes = nodes.map(node => {
    if (node.isFolder && !isPathOnRoute(node.path, targetPath) && node.path !== targetPath) {
      return node;
    }

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
      didChange = true;
      return {
        ...node,
        id: newPath,
        name: newName,
        path: newPath,
        children: updateChildPaths(node.children, targetPath, newPath),
      };
    }
    if (node.isFolder) {
      const nextChildren = updateFolderNode(node.children, targetPath, newName, newPath);
      if (nextChildren === node.children) {
        return node;
      }

      didChange = true;
      return { ...node, children: nextChildren };
    }
    return node;
  });

  return didChange ? nextNodes : nodes;
}

export function updateFolderExpanded(nodes: FileTreeNode[], targetPath: string): FileTreeNode[] {
  let didChange = false;
  const nextNodes = nodes.map(node => {
    if (node.isFolder) {
      if (node.path === targetPath) {
        didChange = true;
        return { ...node, expanded: !node.expanded };
      }

      if (!isPathOnRoute(node.path, targetPath)) {
        return node;
      }

      const nextChildren = updateFolderExpanded(node.children, targetPath);
      if (nextChildren === node.children) {
        return node;
      }

      didChange = true;
      return { ...node, children: nextChildren };
    }
    return node;
  });

  return didChange ? nextNodes : nodes;
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
  let didChange = false;
  const nextNodes = nodes.map((node) => {
    if (!node.isFolder) {
      return node;
    }

    if (!isPathOnRoute(node.path, targetPath)) {
      return node;
    }

    const nextChildren = expandFoldersForPath(node.children, targetPath);
    const nextExpanded = node.expanded || isPathOnRoute(node.path, targetPath);
    if (nextChildren === node.children && nextExpanded === node.expanded) {
      return node;
    }

    didChange = true;
    return {
      ...node,
      expanded: nextExpanded,
      children: nextChildren,
    };
  });

  return didChange ? nextNodes : nodes;
}

export function addNodeToTree(
  nodes: FileTreeNode[],
  targetFolderPath: string | undefined | null,
  newNode: FileTreeNode
): FileTreeNode[] {
  if (!targetFolderPath) {
    return sortFileTree([...nodes, newNode]);
  }

  let didChange = false;
  const nextNodes = nodes.map(node => {
    if (node.isFolder) {
      if (!isPathOnRoute(node.path, targetFolderPath)) {
        return node;
      }

      if (node.path === targetFolderPath) {
        didChange = true;
        return {
          ...node,
          children: sortFileTree([...node.children, newNode]),
          expanded: true // Auto-expand parent when adding child
        };
      }

      const nextChildren = addNodeToTree(node.children, targetFolderPath, newNode);
      if (nextChildren === node.children) {
        return node;
      }

      didChange = true;
      return {
        ...node,
        children: nextChildren
      };
    }
    return node;
  });

  return didChange ? nextNodes : nodes;
}

export function removeNodeFromTree(
  nodes: FileTreeNode[],
  targetPath: string
): FileTreeNode[] {
  let didChange = false;
  const filteredNodes = nodes.filter(node => {
    const shouldKeep = node.path !== targetPath;
    if (!shouldKeep) {
      didChange = true;
    }
    return shouldKeep;
  });

  const nextNodes = filteredNodes.map(node => {
    if (node.isFolder) {
      if (!isPathOnRoute(node.path, targetPath)) {
        return node;
      }

      const nextChildren = removeNodeFromTree(node.children, targetPath);
      if (nextChildren === node.children) {
        return node;
      }

      didChange = true;
      return {
        ...node,
        children: nextChildren
      };
    }
    return node;
  });

  return didChange ? nextNodes : nodes;
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
