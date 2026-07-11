import { getStorageAdapter, joinPath } from '@/lib/storage/adapter';
import { isSupportedMarkdownPath, stripSupportedMarkdownExtension } from '@/lib/notes/markdownFile';
import { isImageFilename } from '@/lib/assets/core/naming';
import type { FileTreeNode } from './types';
import { sortFileTree } from './fileTreeSorting';
import { isSafeNotesRootPathSegment, MAX_NOTES_ROOT_RELATIVE_PATH_CHARS } from './utils/fs/notesRootPathContainment';
import { hasInternalNotePathSegment } from './utils/fs/internalNotePaths';
import {
  MAX_FILE_TREE_DEPTH,
  MAX_FILE_TREE_DIRECTORY_SCAN_ENTRIES,
  MAX_FILE_TREE_ENTRIES,
  MAX_GIT_REPOSITORY_DETECTION_CONCURRENCY,
} from './fileTreeLimits';

const LOW_PRIORITY_DIRECTORY_NAMES = new Set([
  'node_modules',
  'vendor',
  'dist',
  'build',
  'target',
  '__pycache__',
]);

interface FileTreeBuildBudget {
  scannedEntries: number;
  visitedEntries: number;
  listedFolderCount: number;
}

interface FileTreeLevelEntry {
  entryPath: string;
  name: string;
  kind: 'folder' | 'note' | 'image';
}

function isLowPriorityDirectory(name: string) {
  return LOW_PRIORITY_DIRECTORY_NAMES.has(name.toLowerCase());
}

function shouldHideDirectory(name: string) {
  return hasInternalNotePathSegment(name);
}

function getFileTreeScanPriority(entry: { name: string; isDirectory?: boolean; isFile?: boolean }) {
  if (!isSafeNotesRootPathSegment(entry.name)) {
    return 3;
  }

  if (entry.isFile === true && isSupportedMarkdownPath(entry.name)) {
    return 0;
  }

  if (entry.isDirectory === true && !isLowPriorityDirectory(entry.name)) {
    return 1;
  }

  if (entry.isFile === true && isImageFilename(entry.name)) {
    return 2;
  }

  if (entry.isDirectory === true) {
    return 3;
  }

  return 3;
}

function getFileTreeNodeScanPriority(node: FileTreeNode): number {
  if (!node.isFolder && isSupportedMarkdownPath(node.path)) {
    return 0;
  }

  if (node.isFolder) {
    return isLowPriorityDirectory(node.name) ? 2 : 1;
  }

  return 3;
}

function prioritizeFileTreeScanEntries<T extends { name: string; isDirectory?: boolean; isFile?: boolean }>(
  entries: readonly T[],
  maxEntries = entries.length,
): T[] {
  const priorityBuckets: T[][] = [[], [], [], []];
  const limit = Math.max(0, Math.floor(maxEntries));
  if (limit === 0) {
    return [];
  }

  let retainedEntries = 0;
  for (const entry of entries) {
    const priority = getFileTreeScanPriority(entry);
    const bucket = priorityBuckets[priority];
    if (!bucket) {
      continue;
    }

    if (retainedEntries < limit) {
      bucket.push(entry);
      retainedEntries += 1;
      continue;
    }

    for (let worsePriority = priorityBuckets.length - 1; worsePriority > priority; worsePriority -= 1) {
      const worseBucket = priorityBuckets[worsePriority];
      if (worseBucket.length > 0) {
        worseBucket.pop();
        bucket.push(entry);
        break;
      }
    }
  }
  const prioritized: T[] = [];
  for (const bucket of priorityBuckets) {
    for (const entry of bucket) {
      if (prioritized.length >= limit) {
        return prioritized;
      }
      prioritized.push(entry);
    }
  }
  return prioritized;
}

function prioritizeFileTreeNodeScanEntries(
  nodes: readonly FileTreeNode[],
): Array<{ node: FileTreeNode; index: number }> {
  const priorityBuckets: Array<Array<{ node: FileTreeNode; index: number }>> = [[], [], [], []];
  nodes.forEach((node, index) => {
    priorityBuckets[getFileTreeNodeScanPriority(node)]?.push({ node, index });
  });
  return priorityBuckets.flat();
}

async function mapWithConcurrencyLimit<T, R>(
  items: readonly T[],
  limit: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) {
    return [];
  }

  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const workerCount = Math.max(1, Math.min(limit, items.length));
  const workers = Array.from({ length: workerCount }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index]!);
    }
  });

  await Promise.all(workers);
  return results;
}

export async function isGitRepositoryDirectory(fullPath: string) {
  const storage = getStorageAdapter();
  try {
    return await storage.exists(await joinPath(fullPath, '.git'));
  } catch {
    return false;
  }
}

export async function buildFileTreeLevel(
  basePath: string,
  relativePath: string = '',
  budget?: FileTreeBuildBudget,
  options: { detectGitRepositories?: boolean } = {},
): Promise<FileTreeNode[]> {
  const storage = getStorageAdapter();
  const fullPath = relativePath ? await joinPath(basePath, relativePath) : basePath;
  const entries = await storage.listDir(fullPath, { includeHidden: true });
  const detectGitRepositories = options.detectGitRepositories !== false;

  const levelEntries: FileTreeLevelEntry[] = [];
  const remainingScanEntries = budget
    ? MAX_FILE_TREE_DIRECTORY_SCAN_ENTRIES - budget.scannedEntries
    : entries.length;

  for (const entry of prioritizeFileTreeScanEntries(entries, remainingScanEntries)) {
    if (budget && budget.scannedEntries >= MAX_FILE_TREE_DIRECTORY_SCAN_ENTRIES) break;
    if (budget) budget.scannedEntries += 1;
    if (!isSafeNotesRootPathSegment(entry.name)) continue;

    const entryPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;
    if (entryPath.length > MAX_NOTES_ROOT_RELATIVE_PATH_CHARS) continue;

    const isDir = entry.isDirectory === true;
    const isMarkdownFile = entry.isFile === true && isSupportedMarkdownPath(entry.name);
    const isImageFile = entry.isFile === true && isImageFilename(entry.name);
    if (!isDir && !isMarkdownFile && !isImageFile) continue;
    if (isDir && shouldHideDirectory(entry.name)) continue;
    if (budget && budget.visitedEntries >= MAX_FILE_TREE_ENTRIES) break;
    if (budget) budget.visitedEntries += 1;
    levelEntries.push({
      entryPath,
      name: entry.name,
      kind: isDir ? 'folder' : isMarkdownFile ? 'note' : 'image',
    });
  }

  const nodes = await mapWithConcurrencyLimit(
    levelEntries,
    MAX_GIT_REPOSITORY_DETECTION_CONCURRENCY,
    async (entry): Promise<FileTreeNode> => {
      if (entry.kind === 'folder') {
        const isGitRepository = detectGitRepositories && !isLowPriorityDirectory(entry.name)
          ? await isGitRepositoryDirectory(await joinPath(fullPath, entry.name))
          : false;
        return {
          id: entry.entryPath,
          name: entry.name,
          path: entry.entryPath,
          isFolder: true,
          children: [],
          expanded: false,
          ...(isGitRepository ? { isGitRepository: true } : {}),
        };
      }

      return {
        id: entry.entryPath,
        name: entry.kind === 'note' ? stripSupportedMarkdownExtension(entry.name) : entry.name,
        path: entry.entryPath,
        isFolder: false,
        ...(entry.kind === 'image' ? { kind: 'image' as const } : {}),
      };
    },
  );

  return sortFileTree(nodes);
}

async function buildFileTreeWithBudget(
  basePath: string,
  relativePath: string,
  budget: FileTreeBuildBudget,
): Promise<FileTreeNode[]> {
  if (
    budget.scannedEntries >= MAX_FILE_TREE_DIRECTORY_SCAN_ENTRIES ||
    budget.visitedEntries >= MAX_FILE_TREE_ENTRIES
  ) {
    return [];
  }

  let nodes: FileTreeNode[];
  try {
    nodes = await buildFileTreeLevel(basePath, relativePath, budget);
  } catch (error) {
    if (!relativePath) {
      throw error;
    }
    return [];
  }

  const depth = relativePath.split('/').filter(Boolean).length;
  if (depth >= MAX_FILE_TREE_DEPTH) {
    return nodes;
  }

  const scanOrder = prioritizeFileTreeNodeScanEntries(nodes);

  for (const { node, index } of scanOrder) {
    if (!node.isFolder) continue;
    if (budget.visitedEntries >= MAX_FILE_TREE_ENTRIES) continue;
    budget.listedFolderCount += 1;
    nodes[index] = {
      ...node,
      children: await buildFileTreeWithBudget(basePath, node.path, budget),
    };
  }

  return sortFileTree(nodes);
}

export async function buildFileTree(basePath: string, relativePath: string = ''): Promise<FileTreeNode[]> {
  const budget: FileTreeBuildBudget = {
    scannedEntries: 0,
    visitedEntries: 0,
    listedFolderCount: 1,
  };
  return await buildFileTreeWithBudget(basePath, relativePath, budget);
}
