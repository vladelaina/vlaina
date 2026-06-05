import type { FileTreeNode } from '@/stores/notes/types';

const MAX_NAVIGATION_TREE_NODES = 20_000;

export function collectNotePathsInTreeOrder(nodes: readonly FileTreeNode[]): string[] {
  const paths: string[] = [];
  const stack = [...nodes].reverse();
  let visitedNodes = 0;

  while (stack.length > 0 && visitedNodes < MAX_NAVIGATION_TREE_NODES) {
    const entry = stack.pop()!;
    visitedNodes += 1;

    if (entry.isFolder) {
      for (let index = entry.children.length - 1; index >= 0; index -= 1) {
        stack.push(entry.children[index]);
      }
      continue;
    }

    paths.push(entry.path);
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
