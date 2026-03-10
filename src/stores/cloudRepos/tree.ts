import type { TreeEntry } from '@/lib/tauri/githubRepoCommands';
import {
  CLOUD_FOLDER_KEEP_FILE,
  getCloudBaseName,
  getCloudParentPath,
  normalizeCloudRelativePath,
} from './pathOperations';
import type { CloudRepoDraftRecord, CloudRepoNode } from './types';

function compareNodes(a: CloudRepoNode, b: CloudRepoNode): number {
  if (a.kind !== b.kind) {
    return a.kind === 'folder' ? -1 : 1;
  }
  return a.name.localeCompare(b.name);
}

function isVisibleMarkdownFile(path: string): boolean {
  return path.toLowerCase().endsWith('.md');
}

function isFolderPlaceholder(path: string): boolean {
  return getCloudBaseName(path) === CLOUD_FOLDER_KEEP_FILE;
}

function sortTree(nodes: CloudRepoNode[]): CloudRepoNode[] {
  return nodes
    .map((node) => ({
      ...node,
      children: node.children ? sortTree(node.children) : undefined,
    }))
    .sort(compareNodes);
}

function buildExpandedSet(nodes: CloudRepoNode[], expanded = new Set<string>()): Set<string> {
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

function findFolderNode(nodes: CloudRepoNode[], targetPath: string): CloudRepoNode | null {
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

function ensureFolder(
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

export function buildTreeFromRecursiveEntries(
  entries: TreeEntry[],
  previousNodes: CloudRepoNode[] = []
): CloudRepoNode[] {
  const roots: CloudRepoNode[] = [];
  const expandedPaths = buildExpandedSet(previousNodes);

  for (const entry of entries) {
    const normalizedPath = normalizeCloudRelativePath(entry.path);
    if (!normalizedPath) continue;

    if (entry.entryType === 'dir') {
      const folder = ensureFolder(roots, normalizedPath, expandedPaths);
      folder.sha = entry.sha ?? folder.sha;
      continue;
    }

    const parentPath = getCloudParentPath(normalizedPath);
    if (parentPath) {
      ensureFolder(roots, parentPath, expandedPaths);
    }

    if (isFolderPlaceholder(normalizedPath)) {
      continue;
    }

    if (!isVisibleMarkdownFile(normalizedPath)) {
      continue;
    }

    const parentNode = parentPath ? findFolderNode(roots, parentPath) : null;
    const targetChildren = parentNode?.children ?? roots;
    const existingNode = targetChildren.find(
      (node) => node.kind === 'file' && node.path === normalizedPath
    );

    if (!existingNode) {
      targetChildren.push({
        path: normalizedPath,
        name: getCloudBaseName(normalizedPath),
        kind: 'file',
        sha: entry.sha ?? null,
        size: entry.size,
        expanded: false,
      });
    }
  }

  return sortTree(roots);
}

export function toggleNodeExpanded(nodes: CloudRepoNode[], targetPath: string): CloudRepoNode[] {
  return nodes.map((node) => {
    if (node.path === targetPath && node.kind === 'folder') {
      return {
        ...node,
        expanded: !node.expanded,
      };
    }

    if (node.kind !== 'folder' || !node.children) {
      return node;
    }

    return {
      ...node,
      children: toggleNodeExpanded(node.children, targetPath),
    };
  });
}

export function findNode(nodes: CloudRepoNode[], targetPath: string): CloudRepoNode | null {
  for (const node of nodes) {
    if (node.path === targetPath) return node;
    if (node.kind === 'folder' && node.children) {
      const child = findNode(node.children, targetPath);
      if (child) return child;
    }
  }
  return null;
}

export function upsertTreeNode(
  nodes: CloudRepoNode[],
  path: string,
  kind: 'file' | 'folder',
  sha: string | null = null
): CloudRepoNode[] {
  const normalizedPath = normalizeCloudRelativePath(path);
  if (!normalizedPath) return nodes;

  const parentPath = getCloudParentPath(normalizedPath);
  const existingTree = structuredClone(nodes) as CloudRepoNode[];

  if (parentPath) {
    const parent = findFolderNode(existingTree, parentPath) ?? ensureFolder(existingTree, parentPath, new Set());
    const siblings = parent.children ?? [];
    if (!siblings.some((node) => node.path === normalizedPath)) {
      siblings.push({
        path: normalizedPath,
        name: getCloudBaseName(normalizedPath),
        kind,
        sha,
        expanded: kind === 'folder' ? true : false,
        children: kind === 'folder' ? [] : undefined,
      });
      parent.children = sortTree(siblings);
    }
    parent.expanded = true;
    return sortTree(existingTree);
  }

  if (!existingTree.some((node) => node.path === normalizedPath)) {
    existingTree.push({
      path: normalizedPath,
      name: getCloudBaseName(normalizedPath),
      kind,
      sha,
      expanded: kind === 'folder' ? true : false,
      children: kind === 'folder' ? [] : undefined,
    });
  }

  return sortTree(existingTree);
}

export function applyDraftNodes(
  nodes: CloudRepoNode[],
  drafts: CloudRepoDraftRecord[]
): CloudRepoNode[] {
  return drafts.reduce((tree, draft) => {
    if (draft.state === 'conflict' || !isVisibleMarkdownFile(draft.relativePath)) {
      return tree;
    }
    return findNode(tree, draft.relativePath)
      ? tree
      : upsertTreeNode(tree, draft.relativePath, 'file', draft.previousSha);
  }, nodes);
}
