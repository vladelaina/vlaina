import type { FileTreeNode } from '@/stores/notes/types';

export interface TreeSnapshot {
  files: Set<string>;
  folders: Set<string>;
  subtreeSignatures: Map<string, string>;
  truncated: boolean;
}

const MAX_EXTERNAL_TREE_SNAPSHOT_NODES = 20_000;

export function getPathDepth(path: string) {
  return path.split('/').filter(Boolean).length;
}

export function isPathWithin(path: string, basePath: string) {
  return path === basePath || path.startsWith(`${basePath}/`);
}

function toRelativePath(path: string, basePath: string) {
  if (path === basePath) {
    return '';
  }

  return path.slice(basePath.length + 1);
}

export function flattenTreeSnapshot(nodes: FileTreeNode[]): TreeSnapshot {
  const files = new Set<string>();
  const folders = new Set<string>();
  const subtreeSignatures = new Map<string, string>();
  const snapshot = {
    files,
    folders,
    subtreeSignatures,
    truncated: false,
  };

  const stack: Array<{
    descendants: string[];
    entries: FileTreeNode[];
    folder?: FileTreeNode;
    index: number;
    parentFolderPath: string | null;
  }> = [{
    descendants: [],
    entries: nodes,
    index: 0,
    parentFolderPath: null,
  }];
  let visitedNodes = 0;

  while (stack.length > 0) {
    const frame = stack[stack.length - 1];

    if (frame.index >= frame.entries.length) {
      stack.pop();

      if (frame.folder) {
        const childDescendants = [...frame.descendants].sort();
        subtreeSignatures.set(frame.folder.path, childDescendants.join('|'));

        const parent = stack[stack.length - 1];
        if (parent?.parentFolderPath !== null && parent?.parentFolderPath !== undefined) {
          parent.descendants.push(`d:${toRelativePath(frame.folder.path, parent.parentFolderPath)}`);
          parent.descendants.push(
            ...childDescendants.map((descendant) => {
              const kind = descendant.slice(0, 2);
              const relativePath = descendant.slice(2);
              return `${kind}${toRelativePath(`${frame.folder!.path}/${relativePath}`, parent.parentFolderPath!)}`;
            })
          );
        }
      }

      continue;
    }

    const entry = frame.entries[frame.index];
    frame.index += 1;
    visitedNodes += 1;
    if (visitedNodes > MAX_EXTERNAL_TREE_SNAPSHOT_NODES) {
      snapshot.truncated = true;
      return snapshot;
    }

    if (entry.isFolder) {
      folders.add(entry.path);
      stack.push({
        descendants: [],
        entries: entry.children,
        folder: entry,
        index: 0,
        parentFolderPath: entry.path,
      });
      continue;
    }

    files.add(entry.path);
    if (frame.parentFolderPath !== null) {
      frame.descendants.push(`f:${toRelativePath(entry.path, frame.parentFolderPath)}`);
    }
  }

  return snapshot;
}
