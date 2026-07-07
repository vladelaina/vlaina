import {
  getStarredEntryAbsolutePath,
  normalizeStarredRelativePath,
  normalizeStarredNotesRootPath,
} from '@/stores/notes/starred';
import type { StarredEntry } from '@/stores/notes/types';
import type { FileTreeNode, FolderNode } from '@/stores/useNotesStore';
import { isSupportedMarkdownPath } from '@/lib/notes/markdownFile';
import { hasInternalNotePathSegment } from '@/stores/notes/utils/fs/internalNotePaths';
import { normalizeNotesRootRelativePath } from '@/stores/notes/utils/fs/notesRootPathContainment';

export interface NotesSidebarTagScopeEntry {
  path: string;
}

const MAX_SIDEBAR_TAG_SCOPE_PATHS = 10_000;
const MAX_SIDEBAR_TAG_SCOPE_TREE_NODES = 20_000;

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
  let visitedNodes = 0;

  while (
    stack.length > 0 &&
    bucket.size < MAX_SIDEBAR_TAG_SCOPE_PATHS &&
    visitedNodes < MAX_SIDEBAR_TAG_SCOPE_TREE_NODES
  ) {
    const node = stack.pop()!;
    visitedNodes += 1;
    if (node.isFolder) {
      const normalizedFolderPath = normalizeNotesRootRelativePath(node.path, { allowEmpty: true });
      if (normalizedFolderPath === null || hasInternalNotePathSegment(normalizedFolderPath)) {
        continue;
      }

      for (let index = node.children.length - 1; index >= 0; index -= 1) {
        stack.push(node.children[index]);
      }
      continue;
    }

    const normalizedPath = normalizeNotesRootRelativePath(node.path);
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

function getCurrentNotesRootStarredFolders(
  starredEntries: readonly StarredEntry[],
  currentNotesRootPath: string | null | undefined,
): string[] {
  if (!currentNotesRootPath) {
    return [];
  }

  const normalizedCurrentNotesRootPath = normalizeStarredNotesRootPath(currentNotesRootPath);
  return starredEntries
    .filter((entry) =>
      entry.kind === 'folder' &&
      normalizeStarredNotesRootPath(entry.notesRootPath) === normalizedCurrentNotesRootPath
    )
    .map((entry) => normalizeStarredRelativePath(entry.relativePath))
    .filter((path): path is string => path !== null);
}

export function buildNotesSidebarTagScopeEntries({
  rootFolder,
  starredEntries = [],
  currentNotesRootPath = null,
}: {
  rootFolder: FolderNode | null;
  starredEntries?: readonly StarredEntry[];
  currentNotesRootPath?: string | null;
}): NotesSidebarTagScopeEntry[] {
  const paths = new Set<string>();

  if (!rootFolder) {
    const normalizedCurrentNotesRootPath = currentNotesRootPath
      ? normalizeStarredNotesRootPath(currentNotesRootPath)
      : null;
    for (const entry of starredEntries) {
      if (
        entry.kind === 'note' &&
        (!normalizedCurrentNotesRootPath ||
          normalizeStarredNotesRootPath(entry.notesRootPath) === normalizedCurrentNotesRootPath)
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
          normalizedCurrentNotesRootPath
            ? relativePath
            : getStarredEntryAbsolutePath({ ...entry, relativePath }) ?? relativePath,
        );
      }
    }

    return Array.from(paths)
      .sort((a, b) => a.localeCompare(b))
      .map((path) => ({ path }));
  }

  const starredFolders = getCurrentNotesRootStarredFolders(starredEntries, currentNotesRootPath);
  if (starredFolders.length > 0) {
    collectNotePaths(
      rootFolder.children,
      paths,
      (path) => starredFolders.some((folderPath) => isPathInsideFolder(path, folderPath)),
    );
  }
  collectNotePaths(rootFolder.children, paths);

  return Array.from(paths)
    .sort((a, b) => a.localeCompare(b))
    .map((path) => ({ path }));
}
