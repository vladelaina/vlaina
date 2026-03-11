import type { TreeEntry } from '@/lib/tauri/githubRepoCommands';
import { getCloudBaseName, getCloudParentPath, normalizeCloudRelativePath } from '../pathOperations';
import type { CloudRepoNode } from '../types';
import { buildExpandedSet, ensureFolder, findFolderNode, isFolderPlaceholder, isVisibleMarkdownFile, sortTree } from './shared';

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

    if (isFolderPlaceholder(normalizedPath) || !isVisibleMarkdownFile(normalizedPath)) {
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
