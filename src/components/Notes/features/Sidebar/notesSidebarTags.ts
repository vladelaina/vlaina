import {
  getStarredEntryAbsolutePath,
  normalizeStarredRelativePath,
  normalizeStarredVaultPath,
} from '@/stores/notes/starred';
import type { StarredEntry } from '@/stores/notes/types';
import type { FileTreeNode, FolderNode } from '@/stores/useNotesStore';
import { extractNoteTagOccurrences, extractNoteTags } from '@/lib/notes/tags';
import { isSupportedMarkdownPath } from '@/lib/notes/markdownFile';
import { hasInternalNotePathSegment } from '@/stores/notes/utils/fs/internalNotePaths';
import { normalizeVaultRelativePath } from '@/stores/notes/utils/fs/vaultPathContainment';

export interface NotesSidebarTagPath {
  path: string;
  query: string;
  contentMatchOrdinal: number;
}

export interface NotesSidebarTagEntry {
  tag: string;
  count: number;
  paths: NotesSidebarTagPath[];
}

export interface NotesSidebarTagScopeEntry {
  path: string;
}

export interface NotesSidebarTagPathIndexEntry {
  contentSignature: string;
  tags: Map<string, NotesSidebarTagPath>;
}

export interface NotesSidebarTagIndex {
  paths: Map<string, NotesSidebarTagPathIndexEntry>;
  tags: Map<string, Map<string, NotesSidebarTagPath>>;
}

const MAX_SIDEBAR_TAGS = 200;
const MAX_SIDEBAR_TAG_SCOPE_PATHS = 10_000;
const TAG_CONTENT_SIGNATURE_SAMPLE_CHARS = 256;

function createContentSignature(content: string): string {
  let hash = 2166136261;
  for (let index = 0; index < content.length; index += 1) {
    hash ^= content.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  const head = content.slice(0, TAG_CONTENT_SIGNATURE_SAMPLE_CHARS);
  const tail = content.slice(-TAG_CONTENT_SIGNATURE_SAMPLE_CHARS);
  return `${content.length}:${hash >>> 0}:${head}:${tail}`;
}

function isPathInsideFolder(path: string, folderPath: string): boolean {
  if (!folderPath) {
    return true;
  }

  return path === folderPath || path.startsWith(`${folderPath}/`);
}

function collectNotePaths(
  nodes: readonly FileTreeNode[],
  bucket: Set<string>,
  folderFilter?: (path: string) => boolean,
): void {
  const stack = [...nodes].reverse();

  while (stack.length > 0 && bucket.size < MAX_SIDEBAR_TAG_SCOPE_PATHS) {
    const node = stack.pop()!;
    if (node.isFolder) {
      const normalizedFolderPath = normalizeVaultRelativePath(node.path, { allowEmpty: true });
      if (normalizedFolderPath === null || hasInternalNotePathSegment(normalizedFolderPath)) {
        continue;
      }

      for (let index = node.children.length - 1; index >= 0; index -= 1) {
        stack.push(node.children[index]);
      }
      continue;
    }

    const normalizedPath = normalizeVaultRelativePath(node.path);
    if (
      normalizedPath &&
      !hasInternalNotePathSegment(normalizedPath) &&
      isSupportedMarkdownPath(normalizedPath) &&
      (!folderFilter || folderFilter(normalizedPath))
    ) {
      bucket.add(normalizedPath);
    }
  }
}

function getCurrentVaultStarredFolders(
  starredEntries: readonly StarredEntry[],
  currentVaultPath: string | null | undefined,
): string[] {
  if (!currentVaultPath) {
    return [];
  }

  const normalizedCurrentVaultPath = normalizeStarredVaultPath(currentVaultPath);
  return starredEntries
    .filter((entry) =>
      entry.kind === 'folder' &&
      normalizeStarredVaultPath(entry.vaultPath) === normalizedCurrentVaultPath
    )
    .map((entry) => normalizeStarredRelativePath(entry.relativePath))
    .filter((path): path is string => path !== null);
}

export function buildNotesSidebarTagScopeEntries({
  rootFolder,
  starredEntries = [],
  currentVaultPath = null,
}: {
  rootFolder: FolderNode | null;
  starredEntries?: readonly StarredEntry[];
  currentVaultPath?: string | null;
}): NotesSidebarTagScopeEntry[] {
  const paths = new Set<string>();

  if (!rootFolder) {
    const normalizedCurrentVaultPath = currentVaultPath
      ? normalizeStarredVaultPath(currentVaultPath)
      : null;
    for (const entry of starredEntries) {
      if (
        entry.kind === 'note' &&
        (!normalizedCurrentVaultPath ||
          normalizeStarredVaultPath(entry.vaultPath) === normalizedCurrentVaultPath)
      ) {
        const relativePath = normalizeStarredRelativePath(entry.relativePath);
        if (
          !relativePath ||
          hasInternalNotePathSegment(relativePath) ||
          !isSupportedMarkdownPath(relativePath)
        ) {
          continue;
        }

        paths.add(
          normalizedCurrentVaultPath
            ? relativePath
            : getStarredEntryAbsolutePath({ ...entry, relativePath }) ?? relativePath,
        );
      }
    }

    return Array.from(paths)
      .sort((a, b) => a.localeCompare(b))
      .map((path) => ({ path }));
  }

  collectNotePaths(rootFolder.children, paths);

  const starredFolders = getCurrentVaultStarredFolders(starredEntries, currentVaultPath);
  if (starredFolders.length > 0) {
    collectNotePaths(
      rootFolder.children,
      paths,
      (path) => starredFolders.some((folderPath) => isPathInsideFolder(path, folderPath)),
    );
  }

  return Array.from(paths)
    .sort((a, b) => a.localeCompare(b))
    .map((path) => ({ path }));
}

export function extractNotesSidebarTags(content: string): string[] {
  return extractNoteTags(content);
}

export function buildNotesSidebarTags(
  entries: readonly NotesSidebarTagScopeEntry[],
  getNoteContent: (path: string) => string | undefined,
): NotesSidebarTagEntry[] {
  const index = createNotesSidebarTagIndex();
  reconcileNotesSidebarTagIndex(index, entries, getNoteContent);
  return buildNotesSidebarTagsFromTagIndex(index);
}

export function buildNotesSidebarTagPathIndexEntry(
  path: string,
  content: string,
): NotesSidebarTagPathIndexEntry {
  const tags = new Map<string, NotesSidebarTagPath>();

  for (const occurrence of extractNoteTagOccurrences(content)) {
    if (!tags.has(occurrence.tag)) {
      tags.set(occurrence.tag, {
        path,
        query: occurrence.token,
        contentMatchOrdinal: occurrence.matchOrdinal,
      });
    }
  }

  return { contentSignature: createContentSignature(content), tags };
}

export function reconcileNotesSidebarTagPathIndex(
  index: Map<string, NotesSidebarTagPathIndexEntry>,
  entries: readonly NotesSidebarTagScopeEntry[],
  getNoteContent: (path: string) => string | undefined,
): Map<string, NotesSidebarTagPathIndexEntry> {
  const scopedPaths = new Set(entries.map((entry) => entry.path));

  for (const path of index.keys()) {
    if (!scopedPaths.has(path)) {
      index.delete(path);
    }
  }

  for (const entry of entries) {
    const content = getNoteContent(entry.path);
    if (content === undefined) {
      index.delete(entry.path);
      continue;
    }

    const indexed = index.get(entry.path);
    const contentSignature = createContentSignature(content);
    if (indexed?.contentSignature === contentSignature) {
      continue;
    }

    index.set(entry.path, buildNotesSidebarTagPathIndexEntry(entry.path, content));
  }

  return index;
}

export function createNotesSidebarTagIndex(): NotesSidebarTagIndex {
  return {
    paths: new Map(),
    tags: new Map(),
  };
}

function removePathFromTagIndex(index: NotesSidebarTagIndex, path: string) {
  const existing = index.paths.get(path);
  if (!existing) {
    return;
  }

  for (const tag of existing.tags.keys()) {
    const paths = index.tags.get(tag);
    if (!paths) {
      continue;
    }

    paths.delete(path);
    if (paths.size === 0) {
      index.tags.delete(tag);
    }
  }

  index.paths.delete(path);
}

function addPathToTagIndex(
  index: NotesSidebarTagIndex,
  path: string,
  pathIndexEntry: NotesSidebarTagPathIndexEntry,
) {
  index.paths.set(path, pathIndexEntry);

  for (const [tag, tagPath] of pathIndexEntry.tags) {
    const paths = index.tags.get(tag) ?? new Map<string, NotesSidebarTagPath>();
    paths.set(path, tagPath);
    index.tags.set(tag, paths);
  }
}

export function reconcileNotesSidebarTagIndex(
  index: NotesSidebarTagIndex,
  entries: readonly NotesSidebarTagScopeEntry[],
  getNoteContent: (path: string) => string | undefined,
): NotesSidebarTagIndex {
  const scopedPaths = new Set(entries.map((entry) => entry.path));

  for (const path of index.paths.keys()) {
    if (!scopedPaths.has(path)) {
      removePathFromTagIndex(index, path);
    }
  }

  for (const entry of entries) {
    const content = getNoteContent(entry.path);
    if (content === undefined) {
      removePathFromTagIndex(index, entry.path);
      continue;
    }

    const indexed = index.paths.get(entry.path);
    const contentSignature = createContentSignature(content);
    if (indexed?.contentSignature === contentSignature) {
      continue;
    }

    removePathFromTagIndex(index, entry.path);
    addPathToTagIndex(
      index,
      entry.path,
      buildNotesSidebarTagPathIndexEntry(entry.path, content),
    );
  }

  return index;
}

export function buildNotesSidebarTagsFromTagIndex(
  index: NotesSidebarTagIndex,
): NotesSidebarTagEntry[] {
  return Array.from(index.tags.entries())
    .map(([tag, paths]) => ({
      tag,
      count: paths.size,
      paths: Array.from(paths.values()).sort((a, b) => a.path.localeCompare(b.path)),
    }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
    .slice(0, MAX_SIDEBAR_TAGS);
}
