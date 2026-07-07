import type { FileTreeNode } from './types';
import { sortFileTree } from './fileTreeSorting';
import { MAX_FILE_TREE_DERIVED_NODES } from './fileTreeLimits';
import { deepUpdateNodePath } from './fileTreePathUpdate';

type FolderTreeNode = Extract<FileTreeNode, { isFolder: true }>;

interface FolderRouteEntry {
  nodes: FileTreeNode[];
  index: number;
  node: FolderTreeNode;
}

interface FileTreeRoute {
  ancestors: FolderRouteEntry[];
  targetIndex: number | null;
  targetNode: FileTreeNode | null;
  targetNodes: FileTreeNode[];
}

function isPathOnRoute(nodePath: string, targetPath: string): boolean {
  return targetPath === nodePath || targetPath.startsWith(`${nodePath}/`);
}

function findFileTreeRoute(nodes: FileTreeNode[], targetPath: string): FileTreeRoute | null {
  const ancestors: FolderRouteEntry[] = [];
  let currentNodes = nodes;
  let visitedNodes = 0;

  while (visitedNodes < MAX_FILE_TREE_DERIVED_NODES) {
    let routeIndex = -1;

    for (let index = 0; index < currentNodes.length; index += 1) {
      visitedNodes += 1;
      if (visitedNodes > MAX_FILE_TREE_DERIVED_NODES) return null;

      const node = currentNodes[index];
      if (node.path === targetPath) {
        return { ancestors, targetIndex: index, targetNode: node, targetNodes: currentNodes };
      }

      if (node.isFolder && isPathOnRoute(node.path, targetPath)) {
        routeIndex = index;
        break;
      }
    }

    if (routeIndex < 0) {
      return { ancestors, targetIndex: null, targetNode: null, targetNodes: currentNodes };
    }

    const folder = currentNodes[routeIndex] as FolderTreeNode;
    ancestors.push({ nodes: currentNodes, index: routeIndex, node: folder });
    currentNodes = folder.children;
  }

  return null;
}

function rebuildFileTreeRoute(
  ancestors: FolderRouteEntry[],
  targetNodes: FileTreeNode[]
): FileTreeNode[] {
  let nextNodes = targetNodes;

  for (let index = ancestors.length - 1; index >= 0; index -= 1) {
    const entry = ancestors[index];
    const nextFolder = { ...entry.node, children: nextNodes };
    nextNodes = entry.nodes.map((node, nodeIndex) => (
      nodeIndex === entry.index ? nextFolder : node
    ));
  }

  return nextNodes;
}

function replaceRouteFolder(
  ancestors: FolderRouteEntry[],
  entry: FolderRouteEntry,
  replacement: FolderTreeNode
): FileTreeNode[] {
  const nextTargetNodes = entry.nodes.map((node, index) => (
    index === entry.index ? replacement : node
  ));
  return rebuildFileTreeRoute(ancestors, nextTargetNodes);
}

export function updateFileNodePath(
  nodes: FileTreeNode[],
  oldPath: string,
  newPath: string,
  newName: string
): FileTreeNode[] {
  const route = findFileTreeRoute(nodes, oldPath);
  if (!route?.targetNode || route.targetIndex === null || route.targetNode.isFolder) {
    return nodes;
  }

  const nextTargetNodes = route.targetNodes.map((node, index) => (
    index === route.targetIndex
      ? { ...node, id: newPath, path: newPath, name: newName }
      : node
  ));
  return rebuildFileTreeRoute(route.ancestors, nextTargetNodes);
}

export function updateFolderNode(
  nodes: FileTreeNode[],
  targetPath: string,
  newName: string,
  newPath: string
): FileTreeNode[] {
  const route = findFileTreeRoute(nodes, targetPath);
  if (!route?.targetNode || route.targetIndex === null || !route.targetNode.isFolder) {
    return nodes;
  }

  const targetEntry = {
    nodes: route.targetNodes,
    index: route.targetIndex,
    node: route.targetNode,
  };
  const renamedNode = {
    ...deepUpdateNodePath(route.targetNode, targetPath, newPath),
    name: newName,
  } as FolderTreeNode;
  return replaceRouteFolder(route.ancestors, targetEntry, renamedNode);
}

export function updateFolderExpanded(nodes: FileTreeNode[], targetPath: string): FileTreeNode[] {
  const route = findFileTreeRoute(nodes, targetPath);
  if (!route?.targetNode || route.targetIndex === null || !route.targetNode.isFolder) {
    return nodes;
  }

  const targetEntry = {
    nodes: route.targetNodes,
    index: route.targetIndex,
    node: route.targetNode,
  };
  return replaceRouteFolder(route.ancestors, targetEntry, {
    ...route.targetNode,
    expanded: !route.targetNode.expanded,
  });
}

export function collectExpandedPaths(nodes: FileTreeNode[]): Set<string> {
  const expandedPaths = new Set<string>();
  const stack = [...nodes].reverse();
  let visitedNodes = 0;

  while (stack.length > 0 && visitedNodes < MAX_FILE_TREE_DERIVED_NODES) {
    const node = stack.pop()!;
    visitedNodes += 1;

    if (node.isFolder) {
      if (node.expanded) expandedPaths.add(node.path);
      for (let index = node.children.length - 1; index >= 0; index -= 1) {
        stack.push(node.children[index]);
      }
    }
  }

  return expandedPaths;
}

export function restoreExpandedState(
  nodes: FileTreeNode[],
  expandedPaths: Set<string>
): FileTreeNode[] {
  const clonedNodes = new Map<FileTreeNode, FileTreeNode>();
  const stack = nodes.map((node) => ({ node, nextChildIndex: 0 }));

  while (stack.length > 0) {
    const frame = stack[stack.length - 1];
    const current = frame.node;
    if (!current.isFolder) {
      clonedNodes.set(current, current);
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

    clonedNodes.set(current, {
      ...current,
      expanded: expandedPaths.has(current.path),
      children: current.children.map((child) => clonedNodes.get(child)!),
    });
    stack.pop();
  }

  return nodes.map((node) => clonedNodes.get(node) ?? node);
}

export function expandFoldersForPath(nodes: FileTreeNode[], targetPath: string): FileTreeNode[] {
  const route = findFileTreeRoute(nodes, targetPath);
  if (!route || (route.ancestors.length === 0 && !route.targetNode?.isFolder)) {
    return nodes;
  }

  const entries = [...route.ancestors];
  if (route.targetNode?.isFolder && route.targetIndex !== null) {
    entries.push({
      nodes: route.targetNodes,
      index: route.targetIndex,
      node: route.targetNode,
    });
  }

  let nextNodes: FileTreeNode[] | null = null;
  let didChange = false;
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index];
    const childChanged = nextNodes !== null && nextNodes !== entry.node.children;
    if (!childChanged && entry.node.expanded) {
      nextNodes = entry.nodes;
      continue;
    }

    didChange = true;
    const nextNode: FileTreeNode = {
      ...entry.node,
      expanded: true,
      children: nextNodes ?? entry.node.children,
    };
    nextNodes = entry.nodes.map((node, nodeIndex): FileTreeNode => (
      nodeIndex === entry.index ? nextNode : node
    ));
  }

  return didChange && nextNodes ? nextNodes : nodes;
}

export function addNodeToTree(
  nodes: FileTreeNode[],
  targetFolderPath: string | undefined | null,
  newNode: FileTreeNode
): FileTreeNode[] {
  if (!targetFolderPath) {
    return sortFileTree([...nodes, newNode]);
  }

  const route = findFileTreeRoute(nodes, targetFolderPath);
  if (!route?.targetNode || route.targetIndex === null || !route.targetNode.isFolder) {
    return nodes;
  }

  const targetEntry = {
    nodes: route.targetNodes,
    index: route.targetIndex,
    node: route.targetNode,
  };
  return replaceRouteFolder(route.ancestors, targetEntry, {
    ...route.targetNode,
    children: sortFileTree([...route.targetNode.children, newNode]),
    expanded: true,
  });
}

export function removeNodeFromTree(
  nodes: FileTreeNode[],
  targetPath: string
): FileTreeNode[] {
  const route = findFileTreeRoute(nodes, targetPath);
  if (!route?.targetNode || route.targetIndex === null) {
    return nodes;
  }

  const nextTargetNodes = route.targetNodes.filter((_, index) => index !== route.targetIndex);
  return rebuildFileTreeRoute(route.ancestors, nextTargetNodes);
}

export function findNode(nodes: FileTreeNode[], targetPath: string): FileTreeNode | null {
  const stack = [...nodes].reverse();
  let visitedNodes = 0;

  while (stack.length > 0 && visitedNodes < MAX_FILE_TREE_DERIVED_NODES) {
    const node = stack.pop()!;
    visitedNodes += 1;

    if (node.path === targetPath) return node;
    if (node.isFolder) {
      for (let index = node.children.length - 1; index >= 0; index -= 1) {
        stack.push(node.children[index]);
      }
    }
  }

  return null;
}
