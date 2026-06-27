import type { FileTreeNode, NoteMetadataEntry, NotesStore } from '../../types';
import { sortNestedFileTree } from '../../fileTreeSorting';

export function shouldRebuildRootFolderForMetadataChange(
  fileTreeSortMode: NotesStore['fileTreeSortMode'],
  previousEntry: NoteMetadataEntry | undefined,
  nextEntry: NoteMetadataEntry | undefined,
): boolean {
  if (fileTreeSortMode === 'updated-desc') {
    return (previousEntry?.updatedAt ?? 0) !== (nextEntry?.updatedAt ?? 0);
  }

  if (fileTreeSortMode === 'created-desc') {
    return (previousEntry?.createdAt ?? 0) !== (nextEntry?.createdAt ?? 0);
  }

  return false;
}

export function shouldRebuildRootFolderForMetadataFileChange(
  fileTreeSortMode: NotesStore['fileTreeSortMode'],
  rootFolder: NotesStore['rootFolder'],
  previousMetadata: NotesStore['noteMetadata'],
  nextMetadata: NotesStore['noteMetadata'],
): boolean {
  if (!rootFolder || (fileTreeSortMode !== 'updated-desc' && fileTreeSortMode !== 'created-desc')) {
    return false;
  }

  const stack = [...rootFolder.children];
  while (stack.length > 0) {
    const node = stack.pop();
    if (!node) {
      continue;
    }

    if (node.isFolder) {
      stack.push(...node.children);
      continue;
    }

    if (
      shouldRebuildRootFolderForMetadataChange(
        fileTreeSortMode,
        previousMetadata?.notes[node.path],
        nextMetadata?.notes[node.path],
      )
    ) {
      return true;
    }
  }

  return false;
}

function areFileTreeNodesEquivalent(left: FileTreeNode, right: FileTreeNode): boolean {
  if (
    left.id !== right.id ||
    left.name !== right.name ||
    left.path !== right.path ||
    left.isFolder !== right.isFolder
  ) {
    return false;
  }

  if (!left.isFolder || !right.isFolder) {
    return true;
  }

  return left.expanded === right.expanded &&
    Boolean(left.isGitRepository) === Boolean(right.isGitRepository);
}

export function areFileTreeNodeListsEquivalent(
  leftNodes: readonly FileTreeNode[],
  rightNodes: readonly FileTreeNode[],
): boolean {
  const stack: Array<{
    leftNodes: readonly FileTreeNode[];
    rightNodes: readonly FileTreeNode[];
  }> = [{ leftNodes, rightNodes }];

  while (stack.length > 0) {
    const frame = stack.pop();
    if (!frame) {
      continue;
    }
    if (frame.leftNodes.length !== frame.rightNodes.length) {
      return false;
    }

    for (let index = 0; index < frame.leftNodes.length; index += 1) {
      const left = frame.leftNodes[index];
      const right = frame.rightNodes[index];
      if (!left || !right || !areFileTreeNodesEquivalent(left, right)) {
        return false;
      }

      if (left.isFolder && right.isFolder) {
        stack.push({ leftNodes: left.children, rightNodes: right.children });
      }
    }
  }

  return true;
}

export function areRootFoldersEquivalent(
  left: NotesStore['rootFolder'],
  right: NotesStore['rootFolder'],
): boolean {
  if (!left || !right || !areFileTreeNodesEquivalent(left, right)) {
    return false;
  }

  if (!left.isFolder || !right.isFolder) {
    return false;
  }

  return areFileTreeNodeListsEquivalent(left.children, right.children);
}

export function buildSortedRootFolder(
  rootFolder: NotesStore['rootFolder'],
  children: NonNullable<NotesStore['rootFolder']>['children'],
  fileTreeSortMode: NotesStore['fileTreeSortMode'],
  noteMetadata: NotesStore['noteMetadata']
) {
  if (!rootFolder) {
    return null;
  }

  const sortedChildren = sortNestedFileTree(children, {
    mode: fileTreeSortMode,
    metadata: noteMetadata,
  });
  if (areFileTreeNodeListsEquivalent(rootFolder.children, sortedChildren)) {
    return rootFolder;
  }

  return {
    ...rootFolder,
    children: sortedChildren,
  };
}
