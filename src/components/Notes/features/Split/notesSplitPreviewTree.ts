import {
  createInitialNotesSplitPaneTree,
  type NotesSplitPaneTree,
  type NotesSplitPreviewLeaf,
} from './notesSplitTypes';

export function findNotesSplitPreviewLeafByPath(
  tree: NotesSplitPaneTree,
  path: string,
): NotesSplitPreviewLeaf | null {
  if (tree.type === 'preview') {
    return tree.path === path ? tree : null;
  }

  if (tree.type === 'primary') {
    return null;
  }

  return (
    findNotesSplitPreviewLeafByPath(tree.first, path)
    ?? findNotesSplitPreviewLeafByPath(tree.second, path)
  );
}

export function findFirstNotesSplitPreviewLeaf(tree: NotesSplitPaneTree): NotesSplitPreviewLeaf | null {
  if (tree.type === 'preview') {
    return tree;
  }

  if (tree.type === 'primary') {
    return null;
  }

  return findFirstNotesSplitPreviewLeaf(tree.first) ?? findFirstNotesSplitPreviewLeaf(tree.second);
}

function hasNotesSplitPreviewLeaf(tree: NotesSplitPaneTree, leafId: string): boolean {
  if (tree.type === 'preview') {
    return tree.id === leafId;
  }

  if (tree.type === 'primary') {
    return false;
  }

  return hasNotesSplitPreviewLeaf(tree.first, leafId) || hasNotesSplitPreviewLeaf(tree.second, leafId);
}

export function activateNotesSplitPreviewLeaf(
  tree: NotesSplitPaneTree,
  targetLeafId: string,
  replacementPreviewLeaf: NotesSplitPreviewLeaf,
): NotesSplitPaneTree {
  if (!hasNotesSplitPreviewLeaf(tree, targetLeafId)) {
    return tree;
  }

  const replace = (node: NotesSplitPaneTree): NotesSplitPaneTree => {
    if (node.type === 'primary') {
      return replacementPreviewLeaf;
    }

    if (node.type === 'preview') {
      return node.id === targetLeafId
        ? createInitialNotesSplitPaneTree()
        : node;
    }

    const nextFirst = replace(node.first);
    const nextSecond = replace(node.second);
    if (nextFirst === node.first && nextSecond === node.second) {
      return node;
    }

    return {
      ...node,
      first: nextFirst,
      second: nextSecond,
    };
  };

  return replace(tree);
}

export function promoteNotesSplitPreviewLeafToPrimary(
  tree: NotesSplitPaneTree,
  targetLeafId: string,
): NotesSplitPaneTree | null {
  if (!hasNotesSplitPreviewLeaf(tree, targetLeafId)) {
    return tree;
  }

  const promote = (node: NotesSplitPaneTree): NotesSplitPaneTree | null => {
    if (node.type === 'primary') {
      return null;
    }

    if (node.type === 'preview') {
      return node.id === targetLeafId
        ? createInitialNotesSplitPaneTree()
        : node;
    }

    const nextFirst = promote(node.first);
    const nextSecond = promote(node.second);

    if (nextFirst && nextSecond) {
      if (nextFirst === node.first && nextSecond === node.second) {
        return node;
      }

      return {
        ...node,
        first: nextFirst,
        second: nextSecond,
      };
    }

    return nextFirst ?? nextSecond;
  };

  return promote(tree);
}

export function countNotesSplitPreviewLeaves(tree: NotesSplitPaneTree): number {
  if (tree.type === 'preview') {
    return 1;
  }

  if (tree.type === 'primary') {
    return 0;
  }

  return countNotesSplitPreviewLeaves(tree.first) + countNotesSplitPreviewLeaves(tree.second);
}
