import { getNoteTitleFromPath } from '@/lib/notes/displayName';
import { getParentPath } from '@/lib/storage/adapter';
import type { FileTreeNode } from '@/stores/notes/types';

export function resolveWikiLinkNotePath(
  target: string,
  nodes: readonly FileTreeNode[],
  currentNotePath?: string,
): string | null {
  const normalizedTarget = target.trim().toLocaleLowerCase();
  if (!normalizedTarget) return null;

  const matches: string[] = [];
  const stack = [...nodes];
  while (stack.length > 0) {
    const node = stack.pop()!;
    if (node.isFolder) {
      stack.push(...node.children);
      continue;
    }
    if (node.kind === 'image') continue;
    if (getNoteTitleFromPath(node.path).toLocaleLowerCase() === normalizedTarget) {
      matches.push(node.path);
    }
  }

  if (matches.length === 0) return null;
  const currentDirectory = currentNotePath ? getParentPath(currentNotePath) : null;
  return matches.sort((left, right) => {
    const leftIsLocal = currentDirectory !== null && getParentPath(left) === currentDirectory;
    const rightIsLocal = currentDirectory !== null && getParentPath(right) === currentDirectory;
    if (leftIsLocal !== rightIsLocal) return leftIsLocal ? -1 : 1;
    const leftDepth = left.replace(/\\/g, '/').split('/').length;
    const rightDepth = right.replace(/\\/g, '/').split('/').length;
    if (leftDepth !== rightDepth) return leftDepth - rightDepth;
    return left.localeCompare(right);
  })[0] ?? null;
}
