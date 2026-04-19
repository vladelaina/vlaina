import type { FileTreeNode } from '@/stores/notes/types';

export function collectNotePathsInTreeOrder(nodes: readonly FileTreeNode[]): string[] {
  const paths: string[] = [];

  const visit = (entries: readonly FileTreeNode[]) => {
    for (const entry of entries) {
      if (entry.isFolder) {
        visit(entry.children);
        continue;
      }
      paths.push(entry.path);
    }
  };

  visit(nodes);
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
