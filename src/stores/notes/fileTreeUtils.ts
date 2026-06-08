import { getStorageAdapter, joinPath } from '@/lib/storage/adapter';
import { isSupportedMarkdownPath, stripSupportedMarkdownExtension } from '@/lib/notes/markdownFile';
import type { FileTreeNode } from './types';
import { sortFileTree } from './fileTreeSorting';
import { isSafeVaultPathSegment } from './utils/fs/vaultPathContainment';
import { hasInternalNotePathSegment } from './utils/fs/internalNotePaths';

const MAX_FILE_TREE_ENTRIES = 5000;
const MAX_FILE_TREE_DEPTH = 24;
const MAX_FILE_TREE_DERIVED_NODES = 20_000;
const SKIPPED_DIRECTORY_NAMES = new Set([
  'node_modules',
  'vendor',
  'dist',
  'build',
  'target',
  '__pycache__',
]);
interface FileTreeBuildBudget {
  visitedEntries: number;
  skippedFolderCount: number;
  listedFolderCount: number;
}

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

function shouldSkipDirectory(name: string) {
  return SKIPPED_DIRECTORY_NAMES.has(name.toLowerCase());
}

function shouldHideDirectory(name: string) {
  return hasInternalNotePathSegment(name);
}

export async function isGitRepositoryDirectory(fullPath: string) {
  const storage = getStorageAdapter();
  try {
    return await storage.exists(await joinPath(fullPath, '.git'));
  } catch {
    return false;
  }
}

export async function buildFileTreeLevel(
  basePath: string,
  relativePath: string = '',
  budget?: FileTreeBuildBudget,
): Promise<FileTreeNode[]> {
  const storage = getStorageAdapter();
  const fullPath = relativePath ? await joinPath(basePath, relativePath) : basePath;
  const entries = await storage.listDir(fullPath, { includeHidden: true });

  const nodes: FileTreeNode[] = [];

  for (const entry of entries) {
    if (!isSafeVaultPathSegment(entry.name)) continue;

    const entryPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;

    const isDir = entry.isDirectory === true;
    const isMarkdownFile = entry.isFile === true && isSupportedMarkdownPath(entry.name);
    if (!isDir && !isMarkdownFile) continue;
    if (isDir && shouldHideDirectory(entry.name)) continue;

    if (budget && budget.visitedEntries >= MAX_FILE_TREE_ENTRIES) {
      break;
    }
    if (budget) {
      budget.visitedEntries += 1;
    }

    if (isDir) {
      const entryFullPath = await joinPath(fullPath, entry.name);
      const isGitRepository = shouldSkipDirectory(entry.name)
        ? false
        : await isGitRepositoryDirectory(entryFullPath);
      nodes.push({
        id: entryPath,
        name: entry.name,
        path: entryPath,
        isFolder: true,
        children: [],
        expanded: false,
        ...(isGitRepository ? { isGitRepository: true } : {}),
      });
    } else if (isMarkdownFile) {
      nodes.push({
        id: entryPath,
        name: stripSupportedMarkdownExtension(entry.name),
        path: entryPath,
        isFolder: false,
      });
    }
  }

  return sortFileTree(nodes);
}

async function buildFileTreeWithBudget(
  basePath: string,
  relativePath: string,
  budget: FileTreeBuildBudget,
): Promise<FileTreeNode[]> {
  if (budget.visitedEntries >= MAX_FILE_TREE_ENTRIES) {
    return [];
  }

  let nodes: FileTreeNode[];
  try {
    nodes = await buildFileTreeLevel(basePath, relativePath, budget);
  } catch (error) {
    if (!relativePath) {
      throw error;
    }
    return [];
  }

  const depth = relativePath.split('/').filter(Boolean).length;
  if (depth >= MAX_FILE_TREE_DEPTH) {
    return nodes;
  }

  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index];
    if (!node.isFolder) {
      continue;
    }
    if (shouldSkipDirectory(node.name) || budget.visitedEntries >= MAX_FILE_TREE_ENTRIES) {
      budget.skippedFolderCount += 1;
      continue;
    }

    budget.listedFolderCount += 1;
    nodes[index] = {
      ...node,
      children: await buildFileTreeWithBudget(basePath, node.path, budget),
    };
  }

  return sortFileTree(nodes);
}

export async function buildFileTree(basePath: string, relativePath: string = ''): Promise<FileTreeNode[]> {
  const budget: FileTreeBuildBudget = {
    visitedEntries: 0,
    skippedFolderCount: 0,
    listedFolderCount: 1,
  };
  const nodes = await buildFileTreeWithBudget(basePath, relativePath, budget);
  return nodes;
}

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

function isPathOnRoute(nodePath: string, targetPath: string): boolean {
  return targetPath === nodePath || targetPath.startsWith(`${nodePath}/`);
}

function remapPathWithinBase(path: string, oldBasePath: string, newBasePath: string): string {
  if (path === oldBasePath) {
    return newBasePath;
  }

  if (path.startsWith(`${oldBasePath}/`)) {
    return `${newBasePath}${path.slice(oldBasePath.length)}`;
  }

  return path;
}

function findFileTreeRoute(nodes: FileTreeNode[], targetPath: string): FileTreeRoute | null {
  const ancestors: FolderRouteEntry[] = [];
  let currentNodes = nodes;
  let visitedNodes = 0;

  while (visitedNodes < MAX_FILE_TREE_DERIVED_NODES) {
    let routeIndex = -1;

    for (let index = 0; index < currentNodes.length; index += 1) {
      visitedNodes += 1;
      if (visitedNodes > MAX_FILE_TREE_DERIVED_NODES) {
        return null;
      }

      const node = currentNodes[index];
      if (node.path === targetPath) {
        return {
          ancestors,
          targetIndex: index,
          targetNode: node,
          targetNodes: currentNodes,
        };
      }

      if (node.isFolder && isPathOnRoute(node.path, targetPath)) {
        routeIndex = index;
        break;
      }
    }

    if (routeIndex < 0) {
      return {
        ancestors,
        targetIndex: null,
        targetNode: null,
        targetNodes: currentNodes,
      };
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
      if (node.expanded) {
        expandedPaths.add(node.path);
      }
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
  const stack = [...nodes];

  while (stack.length > 0) {
    const current = stack[stack.length - 1];
    if (!current.isFolder) {
      clonedNodes.set(current, current);
      stack.pop();
      continue;
    }

    const pendingChild = current.children.find((child) => !clonedNodes.has(child));
    if (pendingChild) {
      stack.push(pendingChild);
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

export function deepUpdateNodePath(
  node: FileTreeNode,
  oldBasePath: string,
  newBasePath: string
): FileTreeNode {
  const clonedNodes = new Map<FileTreeNode, FileTreeNode>();
  const stack: FileTreeNode[] = [node];

  while (stack.length > 0) {
    const current = stack[stack.length - 1];
    if (!current.isFolder) {
      const newPath = remapPathWithinBase(current.path, oldBasePath, newBasePath);
      clonedNodes.set(current, { ...current, id: newPath, path: newPath });
      stack.pop();
      continue;
    }

    const pendingChild = current.children.find((child) => !clonedNodes.has(child));
    if (pendingChild) {
      stack.push(pendingChild);
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
