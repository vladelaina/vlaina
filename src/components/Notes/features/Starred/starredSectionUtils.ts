import { getNoteTitleFromPath } from '@/lib/notes/displayName';
import type { FileTreeNode, FolderNode, StarredEntry } from '@/stores/notes/types';
import { normalizeStarredVaultPath } from '@/stores/notes/starred';

export function getVaultLabel(
  path: string,
  recentVaults: Array<{ path: string; name: string }>,
): string {
  const normalizedPath = normalizeStarredVaultPath(path);
  const matchedVault = recentVaults.find(
    (vault) => normalizeStarredVaultPath(vault.path) === normalizedPath,
  );
  if (matchedVault) return matchedVault.name;

  const parts = normalizedPath.split('/').filter(Boolean);
  return parts[parts.length - 1] || 'Vault';
}

function getFolderName(path: string): string {
  const parts = path.split('/').filter(Boolean);
  return parts[parts.length - 1] || path;
}

export function getEntryTitle(entry: StarredEntry): string {
  return entry.kind === 'note'
    ? getNoteTitleFromPath(entry.relativePath)
    : getFolderName(entry.relativePath);
}

function isAncestorStarredPath(ancestorPath: string, descendantPath: string) {
  return descendantPath.startsWith(`${ancestorPath}/`);
}

export function sortStarredEntries(entries: StarredEntry[]) {
  return [...entries]
    .map((entry, index) => ({ entry, index }))
    .sort((left, right) => {
      if (left.entry.vaultPath === right.entry.vaultPath) {
        if (isAncestorStarredPath(left.entry.relativePath, right.entry.relativePath)) {
          return 1;
        }
        if (isAncestorStarredPath(right.entry.relativePath, left.entry.relativePath)) {
          return -1;
        }
      }

      return left.index - right.index;
    })
    .map(({ entry }) => entry);
}

function collectNodeLookup(nodes: FileTreeNode[], lookup: Map<string, FileTreeNode>) {
  for (const node of nodes) {
    lookup.set(node.path, node);
    if (node.isFolder) {
      collectNodeLookup(node.children, lookup);
    }
  }
}

export function buildNodeLookup(rootFolder: FolderNode | null) {
  const lookup = new Map<string, FileTreeNode>();
  if (!rootFolder) {
    return lookup;
  }

  collectNodeLookup(rootFolder.children, lookup);
  return lookup;
}
