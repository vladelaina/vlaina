import { buildFileTree } from '@/stores/notes/fileTreeUtils';
import type { FileTreeNode } from '@/stores/notes/types';

interface TreeSnapshot {
  files: Set<string>;
  folders: Set<string>;
  subtreeSignatures: Map<string, string>;
}

const MAX_EXTERNAL_TREE_SNAPSHOT_NODES = 20_000;

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
  const snapshot = {
    files,
    folders,
    subtreeSignatures,
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
  const collapsedRoots = new Set<string>();

  for (const path of sorted) {
    const segments = path.split('/').filter(Boolean);
    let prefix = '';
    let isNestedDeletion = false;
    for (let index = 0; index < segments.length; index += 1) {
      prefix = prefix ? `${prefix}/${segments[index]}` : segments[index]!;
      if (collapsedRoots.has(prefix)) {
        isNestedDeletion = true;
        break;
      }
    }
    if (isNestedDeletion) {
      continue;
    }
    collapsed.push(path);
    collapsedRoots.add(path);
  }

  return collapsed;
}

function hasPathWithinRoots(path: string, roots: ReadonlySet<string>) {
  for (const root of roots) {
    if (isPathWithin(path, root)) {
      return true;
    }
  }
  return false;
}

function matchFolderRenames(previous: TreeSnapshot, next: TreeSnapshot, removedFolders: string[], addedFolders: string[]) {
  const renames: Array<{ oldPath: string; newPath: string }> = [];
  const blockedRemovedRoots = new Set<string>();
  const blockedAddedRoots = new Set<string>();

  const sortedRemoved = [...removedFolders].sort((left, right) => getPathDepth(left) - getPathDepth(right));
  const sortedAdded = [...addedFolders].sort((left, right) => getPathDepth(left) - getPathDepth(right));
  const addedBySignature = new Map<string, string[]>();

  for (const newPath of sortedAdded) {
    const signature = next.subtreeSignatures.get(newPath) ?? '';
    const paths = addedBySignature.get(signature);
    if (paths) {
      paths.push(newPath);
    } else {
      addedBySignature.set(signature, [newPath]);
    }
  }

  for (const oldPath of sortedRemoved) {
    if (hasPathWithinRoots(oldPath, blockedRemovedRoots)) {
      continue;
    }

    const previousSignature = previous.subtreeSignatures.get(oldPath) ?? '';
    const candidates = addedBySignature.get(previousSignature) ?? [];
    let uniqueCandidate: string | null = null;
    let candidateCount = 0;
    for (const newPath of candidates) {
      if (hasPathWithinRoots(newPath, blockedAddedRoots)) {
        continue;
      }
      uniqueCandidate = newPath;
      candidateCount += 1;
      if (candidateCount > 1) {
        break;
      }
    }

    if (candidateCount !== 1 || uniqueCandidate == null) {
      continue;
    }

    const newPath = uniqueCandidate;
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
  const getParentPath = (path: string) => path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
  const getFileName = (path: string) => path.includes('/') ? path.slice(path.lastIndexOf('/') + 1) : path;

  for (const filePath of removedFiles) {
    const parentPath = getParentPath(filePath);
    const entry = candidatesByParent.get(parentPath) ?? { removed: [], added: [] };
    entry.removed.push(filePath);
    candidatesByParent.set(parentPath, entry);
  }

  for (const filePath of addedFiles) {
    const parentPath = getParentPath(filePath);
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

  const unmatchedRemoved = removedFiles.filter((path) => !matchedRemoved.has(path));
  const unmatchedAdded = addedFiles.filter((path) => !matchedAdded.has(path));
  const candidatesByName = new Map<string, { removed: string[]; added: string[] }>();

  for (const filePath of unmatchedRemoved) {
    const fileName = getFileName(filePath);
    const entry = candidatesByName.get(fileName) ?? { removed: [], added: [] };
    entry.removed.push(filePath);
    candidatesByName.set(fileName, entry);
  }

  for (const filePath of unmatchedAdded) {
    const fileName = getFileName(filePath);
    const entry = candidatesByName.get(fileName) ?? { removed: [], added: [] };
    entry.added.push(filePath);
    candidatesByName.set(fileName, entry);
  }

  for (const { removed, added } of candidatesByName.values()) {
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
