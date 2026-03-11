import { getCloudBaseName, getCloudParentPath, normalizeCloudRelativePath } from '../pathOperations';
import type { CloudRepoDraftRecord, CloudRepoNode } from '../types';
import { findNode } from './query';
import { ensureFolder, isVisibleMarkdownFile, sortTree } from './shared';

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
    const parent = ensureFolder(existingTree, parentPath, new Set());
    const siblings = parent.children ?? [];
    if (!siblings.some((node) => node.path === normalizedPath)) {
      siblings.push({
        path: normalizedPath,
        name: getCloudBaseName(normalizedPath),
        kind,
        sha,
        expanded: kind === 'folder',
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
      expanded: kind === 'folder',
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
