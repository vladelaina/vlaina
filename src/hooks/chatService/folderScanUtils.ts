import type { FileTreeNode } from '@/stores/notes/types';
import { isSupportedMarkdownPath } from '@/lib/notes/markdownFile';
import { isSafeNotesRootPathSegment } from '@/stores/notes/utils/fs/notesRootPathContainment';
import { hasInternalNotePathSegment } from '@/stores/notes/utils/fs/internalNotePaths';
import { IMAGE_NAME_REGEX } from './attachmentKinds';
import {
  FOLDER_SCAN_PRIORITY_BUCKETS,
  LOW_PRIORITY_FOLDER_MARKDOWN_DIRECTORY_NAMES,
  MAX_FOLDER_MARKDOWN_SCAN_DEPTH,
  MAX_FOLDER_MARKDOWN_SCAN_ENTRIES,
  MAX_FOLDER_MARKDOWN_TREE_SCAN_ENTRIES,
  MAX_FOLDER_MENTION_NOTES,
  MAX_PROMPT_LABEL_LENGTH,
  PROMPT_LABEL_UNSAFE_PATTERN,
} from './noteMentionConfig';
import { isInsideInternalFolderMarkdownPath } from './noteMentionPaths';

export function isSafeFolderEntryName(name: string): boolean {
  return (
    isSafeNotesRootPathSegment(name) &&
    !name.startsWith('.') &&
    !hasInternalNotePathSegment(name)
  );
}

export function isSafeFolderListingEntryName(name: string): boolean {
  return (
    isSafeNotesRootPathSegment(name) &&
    !hasInternalNotePathSegment(name)
  );
}

function isSafeFolderMarkdownEntryName(name: string): boolean {
  return isSafeNotesRootPathSegment(name);
}

function shouldHideFolderMarkdownDirectory(name: string): boolean {
  return hasInternalNotePathSegment(name);
}

function isLowPriorityFolderMarkdownDirectory(name: string): boolean {
  return LOW_PRIORITY_FOLDER_MARKDOWN_DIRECTORY_NAMES.has(name.toLowerCase());
}

export function prioritizeFolderScanEntries<T extends { name: string; isDirectory?: boolean; isFile?: boolean }>(
  entries: readonly T[],
  getPriority: (entry: T) => number,
  maxEntries = entries.length,
): T[] {
  const buckets = Array.from(
    { length: FOLDER_SCAN_PRIORITY_BUCKETS },
    () => [] as T[],
  );
  const limit = Math.max(0, Math.floor(maxEntries));
  if (limit === 0) {
    return [];
  }

  let retainedEntries = 0;
  for (const entry of entries) {
    const priority = getPriority(entry);
    const bucket = buckets[priority];
    if (!bucket) {
      continue;
    }

    if (retainedEntries < limit) {
      bucket.push(entry);
      retainedEntries += 1;
      continue;
    }

    for (let worsePriority = buckets.length - 1; worsePriority > priority; worsePriority -= 1) {
      const worseBucket = buckets[worsePriority];
      if (worseBucket.length > 0) {
        worseBucket.pop();
        bucket.push(entry);
        break;
      }
    }
  }
  const prioritized: T[] = [];
  for (const bucket of buckets) {
    for (const entry of bucket) {
      if (prioritized.length >= limit) {
        return prioritized;
      }
      prioritized.push(entry);
    }
  }
  return prioritized;
}

export function prioritizeFolderMarkdownScanEntries<T extends { name: string; isDirectory?: boolean; isFile?: boolean }>(
  entries: readonly T[],
  maxEntries = entries.length,
): T[] {
  const prioritized = prioritizeFolderScanEntries(
    entries,
    getFolderMarkdownScanPriority,
    maxEntries,
  );
  return prioritized
    .map((entry, index) => ({ entry, index, priority: getFolderMarkdownScanPriority(entry) }))
    .sort((left, right) =>
      left.priority - right.priority ||
      left.entry.name.localeCompare(right.entry.name) ||
      left.index - right.index
    )
    .map(({ entry }) => entry);
}

function getFolderMarkdownScanPriority(entry: { name: string; isDirectory?: boolean; isFile?: boolean }) {
  if (!isSafeFolderMarkdownEntryName(entry.name)) {
    return 3;
  }
  if (entry.isFile && isSupportedMarkdownPath(entry.name)) {
    return 0;
  }
  if (entry.isDirectory && !isLowPriorityFolderMarkdownDirectory(entry.name)) {
    return 1;
  }
  if (entry.isDirectory) {
    return 2;
  }
  return 3;
}

function getMentionFolderMarkdownNodeScanPriority(node: FileTreeNode): number {
  if (!node.isFolder && isSupportedMarkdownPath(node.path)) {
    return 0;
  }
  if (node.isFolder && !isLowPriorityFolderMarkdownDirectory(node.name)) {
    return 1;
  }
  if (node.isFolder) {
    return 2;
  }
  return 3;
}

function prioritizeMentionFolderMarkdownNodes(
  nodes: readonly FileTreeNode[],
  maxEntries = nodes.length,
): FileTreeNode[] {
  const buckets = Array.from(
    { length: FOLDER_SCAN_PRIORITY_BUCKETS },
    () => [] as FileTreeNode[],
  );
  const limit = Math.max(0, Math.floor(maxEntries));
  if (limit === 0) {
    return [];
  }

  let retainedEntries = 0;
  for (const node of nodes) {
    const priority = getMentionFolderMarkdownNodeScanPriority(node);
    const bucket = buckets[priority];
    if (!bucket) {
      continue;
    }

    if (retainedEntries < limit) {
      bucket.push(node);
      retainedEntries += 1;
      continue;
    }

    for (let worsePriority = buckets.length - 1; worsePriority > priority; worsePriority -= 1) {
      const worseBucket = buckets[worsePriority];
      if (worseBucket.length > 0) {
        worseBucket.pop();
        bucket.push(node);
        break;
      }
    }
  }
  const prioritized: FileTreeNode[] = [];
  for (const bucket of buckets) {
    for (const node of bucket) {
      if (prioritized.length >= limit) {
        return prioritized;
      }
      prioritized.push(node);
    }
  }
  return prioritized;
}

export function getFolderListingScanPriority(entry: { name: string }) {
  return isSafeFolderListingEntryName(entry.name) ? 0 : 1;
}

export function getFolderImageScanPriority(entry: { name: string; isFile?: boolean }) {
  if (!isSafeFolderEntryName(entry.name)) {
    return 2;
  }
  return entry.isFile && IMAGE_NAME_REGEX.test(entry.name) ? 0 : 1;
}

export function collectMentionFolderMarkdownNodes(
  nodes: readonly FileTreeNode[],
  options: { maxResults?: number } = {},
): FileTreeNode[] {
  const result: FileTreeNode[] = [];
  const maxResults = Math.max(0, Math.floor(options.maxResults ?? MAX_FOLDER_MENTION_NOTES));
  const stack: Array<{ nodes: readonly FileTreeNode[]; index: number; depth: number }> = [{
    nodes: prioritizeMentionFolderMarkdownNodes(nodes, MAX_FOLDER_MARKDOWN_TREE_SCAN_ENTRIES),
    index: 0,
    depth: 0,
  }];
  let visitedEntries = 0;
  let scannedEntries = 0;

  while (
    stack.length > 0 &&
    scannedEntries < MAX_FOLDER_MARKDOWN_TREE_SCAN_ENTRIES &&
    visitedEntries < MAX_FOLDER_MARKDOWN_SCAN_ENTRIES &&
    result.length < maxResults
  ) {
    const frame = stack[stack.length - 1];
    if (frame.index >= frame.nodes.length) {
      stack.pop();
      continue;
    }

    const node = frame.nodes[frame.index];
    frame.index += 1;
    if (!node) continue;
    scannedEntries += 1;

    if (node.isFolder) {
      if (
        shouldHideFolderMarkdownDirectory(node.name) ||
        isInsideInternalFolderMarkdownPath(node.path)
      ) {
        continue;
      }
      if (frame.depth >= MAX_FOLDER_MARKDOWN_SCAN_DEPTH) {
        continue;
      }
      const remainingScanEntries = MAX_FOLDER_MARKDOWN_TREE_SCAN_ENTRIES - scannedEntries;
      stack.push({
        nodes: prioritizeMentionFolderMarkdownNodes(node.children, remainingScanEntries),
        index: 0,
        depth: frame.depth + 1,
      });
      continue;
    }

    if (isSupportedMarkdownPath(node.path) && !isInsideInternalFolderMarkdownPath(node.path)) {
      visitedEntries += 1;
      result.push(node);
    }
  }

  return result;
}

export function formatPromptLabel(value: string, fallback: string): string {
  const label = value
    .replace(PROMPT_LABEL_UNSAFE_PATTERN, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return (label || fallback).slice(0, MAX_PROMPT_LABEL_LENGTH);
}

export function formatFolderEntrySize(size: number | undefined): string {
  if (typeof size !== 'number' || !Number.isFinite(size) || size < 0) {
    return '';
  }
  if (size < 1024) {
    return `, ${size} B`;
  }
  if (size < 1024 * 1024) {
    return `, ${(size / 1024).toFixed(1)} KB`;
  }
  return `, ${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export { isSafeFolderMarkdownEntryName, shouldHideFolderMarkdownDirectory };
