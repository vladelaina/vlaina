import { isSupportedMarkdownPath } from '@/lib/notes/markdownFile';
import { isAbsolutePath, normalizeAbsolutePath } from '@/lib/storage/adapter';
import { findNode, removeNodeFromTree } from '../fileTreeUtils';
import {
  getStarredEntryAbsolutePath,
  getStarredNotesRootPathComparisonKey,
  isSameStarredNotesRootPath,
} from '../starred';
import {
  isSameExternalPath,
  shouldRemoveForExternalDeletion,
} from '../document/externalPathSync';
import { hasInternalNotePathSegment } from '../utils/fs/internalNotePaths';
import { hasUnsafeNotesRootPathSegment, normalizeNotesRootRelativePath } from '../utils/fs/notesRootPathContainment';
import type { NotesGet } from './workspaceSliceTypes';
import type { FileTreeNode } from '../types';

export function isKnownNoteFilePath(
  input: {
    currentNote: ReturnType<NotesGet>['currentNote'];
    openTabs: ReturnType<NotesGet>['openTabs'];
    recentNotes: ReturnType<NotesGet>['recentNotes'];
    noteContentsCache: ReturnType<NotesGet>['noteContentsCache'];
    noteMetadata: ReturnType<NotesGet>['noteMetadata'];
    notesPath: ReturnType<NotesGet>['notesPath'];
    rootFolder: ReturnType<NotesGet>['rootFolder'];
    starredEntries: ReturnType<NotesGet>['starredEntries'];
  },
  path: string,
) {
  const node = input.rootFolder ? findNode(input.rootFolder.children, path) : null;
  if (node) {
    return !node.isFolder;
  }

  return Boolean(
    input.currentNote?.path === path ||
    input.openTabs.some((tab) => tab.path === path) ||
    input.recentNotes.includes(path) ||
    input.noteContentsCache.has(path) ||
    Object.prototype.hasOwnProperty.call(input.noteMetadata?.notes ?? {}, path) ||
    input.starredEntries.some((entry) => {
      if (entry.kind !== 'note') {
        return false;
      }

      if (isSameStarredNotesRootPath(entry.notesRootPath, input.notesPath) && entry.relativePath === path) {
        return true;
      }

      return isAbsolutePath(path) &&
        getStarredNotesRootPathComparisonKey(getStarredEntryAbsolutePath(entry) ?? '') ===
          getStarredNotesRootPathComparisonKey(path);
    })
  );
}

function hasUnsafeExternalPathSegment(path: string): boolean {
  const normalizedPath = isAbsolutePath(path) ? normalizeAbsolutePath(path) : path;
  return hasUnsafeNotesRootPathSegment(normalizedPath, {
    allowNavigationSegments: true,
  });
}

export function isAllowedExternalActionPath(path: string): boolean {
  const normalizedPath = isAbsolutePath(path) ? normalizeAbsolutePath(path) : path;
  if (
    hasInternalNotePathSegment(normalizedPath) ||
    hasUnsafeExternalPathSegment(normalizedPath)
  ) {
    return false;
  }

  return isAbsolutePath(normalizedPath) || normalizeNotesRootRelativePath(normalizedPath) != null;
}

export function hasPreservedDeletedPath(
  preservedDeletedPaths: ReadonlySet<string>,
  path: string,
): boolean {
  for (const preservedPath of preservedDeletedPaths) {
    if (isSameExternalPath(preservedPath, path)) {
      return true;
    }
  }
  return false;
}

function hasPreservedDeletedDescendant(
  preservedDeletedPaths: ReadonlySet<string>,
  folderPath: string,
): boolean {
  for (const preservedPath of preservedDeletedPaths) {
    if (shouldRemoveForExternalDeletion(preservedPath, folderPath)) {
      return true;
    }
  }
  return false;
}

export function pruneFileTreeForExternalDeletion(
  nodes: FileTreeNode[],
  deletedPath: string,
  preservedDeletedPaths: ReadonlySet<string> | null,
): FileTreeNode[] {
  if (!preservedDeletedPaths || preservedDeletedPaths.size === 0) {
    return removeNodeFromTree(nodes, deletedPath);
  }

  let changed = false;
  const nextNodes: FileTreeNode[] = [];

  for (const node of nodes) {
    const nodeIsDeleted = shouldRemoveForExternalDeletion(node.path, deletedPath);
    const deletedPathIsInFolder = node.isFolder && shouldRemoveForExternalDeletion(deletedPath, node.path);
    if (!nodeIsDeleted && !deletedPathIsInFolder) {
      nextNodes.push(node);
      continue;
    }

    if (!node.isFolder) {
      if (nodeIsDeleted && hasPreservedDeletedPath(preservedDeletedPaths, node.path)) {
        nextNodes.push(node);
      } else {
        changed = true;
      }
      continue;
    }

    const nextChildren = pruneFileTreeForExternalDeletion(
      node.children,
      deletedPath,
      preservedDeletedPaths,
    );
    const shouldKeepFolder =
      !nodeIsDeleted ||
      hasPreservedDeletedPath(preservedDeletedPaths, node.path) ||
      hasPreservedDeletedDescendant(preservedDeletedPaths, node.path);

    if (!shouldKeepFolder) {
      changed = true;
      continue;
    }

    if (nextChildren !== node.children) {
      changed = true;
      nextNodes.push({ ...node, children: nextChildren });
      continue;
    }

    nextNodes.push(node);
  }

  return changed ? nextNodes : nodes;
}

export function shouldDeleteRenamedKnownNote(oldPath: string, newPath: string): boolean {
  return isSupportedMarkdownPath(oldPath) && !isSupportedMarkdownPath(newPath);
}
