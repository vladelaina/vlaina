import type { FileTreeNode } from '@/stores/notes/types';
import { isSupportedMarkdownPath } from '@/lib/notes/markdownFile';
import { hasInternalNotePathSegment } from '@/stores/notes/utils/fs/internalNotePaths';
import { normalizeNotesRootRelativePath } from '@/stores/notes/utils/fs/notesRootPathContainment';

const MAX_NAVIGATION_TREE_NODES = 20_000;
const NAVIGATION_SCAN_PRIORITY_BUCKETS = 2;

function getNavigableNotePath(entry: FileTreeNode): string | null {
  if (entry.isFolder) {
    return null;
  }

  const normalizedPath = normalizeNotesRootRelativePath(entry.path);
  if (
    !normalizedPath ||
    hasInternalNotePathSegment(normalizedPath) ||
    !isSupportedMarkdownPath(normalizedPath)
  ) {
    return null;
  }

  return normalizedPath;
}

function getNavigationScanPriority(entry: FileTreeNode): number {
  if (entry.isFolder || getNavigableNotePath(entry)) {
    return 0;
  }

  return 1;
}

function prioritizeNavigationScanNodes(nodes: readonly FileTreeNode[]): FileTreeNode[] {
  const buckets = Array.from(
    { length: NAVIGATION_SCAN_PRIORITY_BUCKETS },
    () => [] as FileTreeNode[],
  );
  for (const node of nodes) {
    const priority = getNavigationScanPriority(node);
    buckets[priority]?.push(node);
  }
  return buckets.flat();
}

export function collectNotePathsInTreeOrder(nodes: readonly FileTreeNode[]): string[] {
  const paths: string[] = [];
  const stack = prioritizeNavigationScanNodes(nodes).reverse();
  let visitedNodes = 0;

  while (stack.length > 0 && visitedNodes < MAX_NAVIGATION_TREE_NODES) {
    const entry = stack.pop()!;
    visitedNodes += 1;

    if (entry.isFolder) {
      const prioritizedChildren = prioritizeNavigationScanNodes(entry.children);
      for (let index = prioritizedChildren.length - 1; index >= 0; index -= 1) {
        stack.push(prioritizedChildren[index]);
      }
      continue;
    }

    const navigablePath = getNavigableNotePath(entry);
    if (navigablePath) {
      paths.push(navigablePath);
    }
  }

  return paths;
}

export function getAdjacentTreeNotePath(
  notePaths: readonly string[],
  currentPath: string,
  direction: 'next' | 'previous',
): string | null {
  if (notePaths.length <= 1) {
    return null;
  }

  const currentIndex = notePaths.indexOf(currentPath);
  if (currentIndex === -1) {
    return null;
  }

  if (direction === 'next') {
    return notePaths[currentIndex === notePaths.length - 1 ? 0 : currentIndex + 1] ?? null;
  }

  return notePaths[currentIndex === 0 ? notePaths.length - 1 : currentIndex - 1] ?? null;
}
