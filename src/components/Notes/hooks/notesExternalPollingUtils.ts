import { buildFileTree } from '@/stores/notes/fileTreeUtils';
import type { FileTreeNode } from '@/stores/notes/types';

interface TreeSnapshot {
  files: Set<string>;
  folders: Set<string>;
  subtreeSignatures: Map<string, string>;
}

export interface ExternalTreePathChanges {
  renames: Array<{ oldPath: string; newPath: string }>;
  deletions: string[];
  hasAdditions: boolean;
  hasChanges: boolean;
}

function getPathDepth(path: string) {
  return path.split('/').filter(Boolean).length;
}

function isPathWithin(path: string, basePath: string) {
  return path === basePath || path.startsWith(`${basePath}/`);
}

function toRelativePath(path: string, basePath: string) {
  if (path === basePath) {
    return '';
  }

  return path.slice(basePath.length + 1);
}

function flattenTreeSnapshot(nodes: FileTreeNode[]): TreeSnapshot {
  const files = new Set<string>();
  const folders = new Set<string>();
  const subtreeSignatures = new Map<string, string>();

  const visit = (entries: FileTreeNode[]) => {
    for (const entry of entries) {
      if (entry.isFolder) {
        folders.add(entry.path);
        visit(entry.children);
      } else {
        files.add(entry.path);
      }
    }
  };

  const buildFolderSignature = (folderPath: string) => {
    const descendants: string[] = [];

    for (const nestedFolder of folders) {
      if (nestedFolder === folderPath) {
        continue;
      }
      if (isPathWithin(nestedFolder, folderPath)) {
        descendants.push(`d:${toRelativePath(nestedFolder, folderPath)}`);
      }
    }

    for (const filePath of files) {
      if (isPathWithin(filePath, folderPath)) {
        descendants.push(`f:${toRelativePath(filePath, folderPath)}`);
      }
    }

    descendants.sort();
    subtreeSignatures.set(folderPath, descendants.join('|'));
  };

  visit(nodes);

  for (const folderPath of folders) {
    buildFolderSignature(folderPath);
  }

  return {
    files,
    folders,
    subtreeSignatures,
  };
}

function collectDiff(previous: Set<string>, next: Set<string>) {
  const removed: string[] = [];
  const added: string[] = [];

  for (const path of previous) {
    if (!next.has(path)) {
      removed.push(path);
    }
  }

  for (const path of next) {
    if (!previous.has(path)) {
      added.push(path);
    }
  }

  return { removed, added };
}

function filterOutsideRenamedSubtrees(paths: string[], blockedRoots: Set<string>) {
  return paths.filter((path) => {
    for (const root of blockedRoots) {
      if (isPathWithin(path, root)) {
        return false;
      }
    }
    return true;
  });
}

function collapseDeletionPaths(paths: string[]) {
  const sorted = [...paths].sort((left, right) => getPathDepth(left) - getPathDepth(right));
  const collapsed: string[] = [];

  for (const path of sorted) {
    if (collapsed.some((candidate) => isPathWithin(path, candidate))) {
      continue;
    }
    collapsed.push(path);
  }

  return collapsed;
}

function matchFolderRenames(previous: TreeSnapshot, next: TreeSnapshot, removedFolders: string[], addedFolders: string[]) {
  const renames: Array<{ oldPath: string; newPath: string }> = [];
  const blockedRemovedRoots = new Set<string>();
  const blockedAddedRoots = new Set<string>();

  const sortedRemoved = [...removedFolders].sort((left, right) => getPathDepth(left) - getPathDepth(right));
  const sortedAdded = [...addedFolders].sort((left, right) => getPathDepth(left) - getPathDepth(right));

  for (const oldPath of sortedRemoved) {
    if ([...blockedRemovedRoots].some((root) => isPathWithin(oldPath, root))) {
      continue;
    }

    const previousSignature = previous.subtreeSignatures.get(oldPath) ?? '';
    const candidates = sortedAdded.filter((newPath) => {
      if ([...blockedAddedRoots].some((root) => isPathWithin(newPath, root))) {
        return false;
      }
      return (next.subtreeSignatures.get(newPath) ?? '') === previousSignature;
    });

    if (candidates.length !== 1) {
      continue;
    }

    const [newPath] = candidates;
    renames.push({ oldPath, newPath });
    blockedRemovedRoots.add(oldPath);
    blockedAddedRoots.add(newPath);
  }

  return {
    renames,
    blockedRemovedRoots,
    blockedAddedRoots,
  };
}

function matchFileRenames(removedFiles: string[], addedFiles: string[]) {
  const renames: Array<{ oldPath: string; newPath: string }> = [];
  const matchedRemoved = new Set<string>();
  const matchedAdded = new Set<string>();
  const candidatesByParent = new Map<string, { removed: string[]; added: string[] }>();

  for (const filePath of removedFiles) {
    const parentPath = filePath.includes('/') ? filePath.slice(0, filePath.lastIndexOf('/')) : '';
    const entry = candidatesByParent.get(parentPath) ?? { removed: [], added: [] };
    entry.removed.push(filePath);
    candidatesByParent.set(parentPath, entry);
  }

  for (const filePath of addedFiles) {
    const parentPath = filePath.includes('/') ? filePath.slice(0, filePath.lastIndexOf('/')) : '';
    const entry = candidatesByParent.get(parentPath) ?? { removed: [], added: [] };
    entry.added.push(filePath);
    candidatesByParent.set(parentPath, entry);
  }

  for (const { removed, added } of candidatesByParent.values()) {
    if (removed.length !== 1 || added.length !== 1) {
      continue;
    }

    renames.push({ oldPath: removed[0], newPath: added[0] });
    matchedRemoved.add(removed[0]);
    matchedAdded.add(added[0]);
  }

  return {
    renames,
    remainingRemovedFiles: removedFiles.filter((path) => !matchedRemoved.has(path)),
    remainingAddedFiles: addedFiles.filter((path) => !matchedAdded.has(path)),
  };
}

export function detectExternalTreePathChanges(
  previousNodes: FileTreeNode[],
  nextNodes: FileTreeNode[]
): ExternalTreePathChanges {
  const previous = flattenTreeSnapshot(previousNodes);
  const next = flattenTreeSnapshot(nextNodes);

  const fileDiff = collectDiff(previous.files, next.files);
  const folderDiff = collectDiff(previous.folders, next.folders);

  const folderRenameMatch = matchFolderRenames(
    previous,
    next,
    folderDiff.removed,
    folderDiff.added
  );

  const remainingRemovedFolders = filterOutsideRenamedSubtrees(
    folderDiff.removed,
    folderRenameMatch.blockedRemovedRoots
  );
  const remainingAddedFolders = filterOutsideRenamedSubtrees(
    folderDiff.added,
    folderRenameMatch.blockedAddedRoots
  );
  const remainingRemovedFiles = filterOutsideRenamedSubtrees(
    fileDiff.removed,
    folderRenameMatch.blockedRemovedRoots
  );
  const remainingAddedFiles = filterOutsideRenamedSubtrees(
    fileDiff.added,
    folderRenameMatch.blockedAddedRoots
  );

  const fileRenameMatch = matchFileRenames(remainingRemovedFiles, remainingAddedFiles);
  const deletions = collapseDeletionPaths([
    ...remainingRemovedFolders,
    ...fileRenameMatch.remainingRemovedFiles,
  ]);
  const hasAdditions =
    remainingAddedFolders.length > 0 || fileRenameMatch.remainingAddedFiles.length > 0;
  const renames = [...folderRenameMatch.renames, ...fileRenameMatch.renames];

  return {
    renames,
    deletions,
    hasAdditions,
    hasChanges: renames.length > 0 || deletions.length > 0 || hasAdditions,
  };
}

export async function buildExternalTreeSnapshot(notesPath: string) {
  return buildFileTree(notesPath);
}
