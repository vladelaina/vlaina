import {
  NOTES_SPLIT_DEFAULT_RATIO,
  clampNotesSplitRatio,
  getNotesSplitOrientation,
  type NotesSplitDirection,
  type NotesSplitLeaf,
  type NotesSplitPaneTree,
  type NotesSplitPreviewLeaf
} from './notesSplitTypes';

export { resolveNotesSplitDropDirection } from './notesSplitDrop';
export {
  activateNotesSplitPreviewLeaf,
  countNotesSplitPreviewLeaves,
  findFirstNotesSplitPreviewLeaf,
  findNotesSplitPreviewLeafByPath,
  promoteNotesSplitPreviewLeafToPrimary
} from './notesSplitPreviewTree';
export {
  NOTES_SPLIT_DEFAULT_RATIO,
  NOTES_SPLIT_MAX_RATIO,
  NOTES_SPLIT_MIN_RATIO,
  NOTES_SPLIT_PRIMARY_LEAF_ID,
  clampNotesSplitRatio,
  createInitialNotesSplitPaneTree,
  getNotesSplitOrientation,
  isVerticalNotesSplit,
  type NotesSplitDirection,
  type NotesSplitLeaf,
  type NotesSplitNode,
  type NotesSplitOrientation,
  type NotesSplitPaneTree,
  type NotesSplitPreviewLeaf,
  type NotesSplitPrimaryLeaf,
  type NotesSplitRect
} from './notesSplitTypes';

export function splitNotesPaneTree(
  tree: NotesSplitPaneTree,
  targetLeafId: string,
  previewLeaf: NotesSplitPreviewLeaf,
  direction: NotesSplitDirection,
  splitId: string,
): NotesSplitPaneTree {
  return insertNotesSplitLeaf(tree, targetLeafId, previewLeaf, direction, splitId);
}

function insertNotesSplitLeaf(
  tree: NotesSplitPaneTree,
  targetLeafId: string,
  leaf: NotesSplitLeaf,
  direction: NotesSplitDirection,
  splitId: string,
): NotesSplitPaneTree {
  if (tree.type !== 'split') {
    if (tree.id !== targetLeafId) {
      return tree;
    }

    const shouldInsertBefore = direction === 'left' || direction === 'top';
    return {
      type: 'split',
      id: splitId,
      direction,
      orientation: getNotesSplitOrientation(direction),
      ratio: NOTES_SPLIT_DEFAULT_RATIO,
      first: shouldInsertBefore ? leaf : tree,
      second: shouldInsertBefore ? tree : leaf,
    };
  }

  const nextFirst = insertNotesSplitLeaf(tree.first, targetLeafId, leaf, direction, splitId);
  if (nextFirst !== tree.first) {
    return {
      ...tree,
      first: nextFirst,
    };
  }

  const nextSecond = insertNotesSplitLeaf(tree.second, targetLeafId, leaf, direction, splitId);
  if (nextSecond !== tree.second) {
    return {
      ...tree,
      second: nextSecond,
    };
  }

  return tree;
}

function findNotesSplitLeafById(tree: NotesSplitPaneTree, leafId: string): NotesSplitLeaf | null {
  if (tree.type !== 'split') {
    return tree.id === leafId ? tree : null;
  }

  return findNotesSplitLeafById(tree.first, leafId) ?? findNotesSplitLeafById(tree.second, leafId);
}

function hasNotesSplitLeaf(tree: NotesSplitPaneTree, leafId: string): boolean {
  return Boolean(findNotesSplitLeafById(tree, leafId));
}

function pruneNotesSplitLeafById(
  tree: NotesSplitPaneTree,
  leafId: string,
): NotesSplitPaneTree | null {
  if (tree.type !== 'split') {
    return tree.id === leafId ? null : tree;
  }

  const nextFirst = pruneNotesSplitLeafById(tree.first, leafId);
  const nextSecond = pruneNotesSplitLeafById(tree.second, leafId);

  if (nextFirst && nextSecond) {
    if (nextFirst === tree.first && nextSecond === tree.second) {
      return tree;
    }

    return {
      ...tree,
      first: nextFirst,
      second: nextSecond,
    };
  }

  return nextFirst ?? nextSecond;
}

export function moveNotesSplitPaneLeaf(
  tree: NotesSplitPaneTree,
  sourceLeafId: string,
  targetLeafId: string,
  direction: NotesSplitDirection,
  splitId: string,
): NotesSplitPaneTree {
  if (sourceLeafId === targetLeafId) {
    return tree;
  }

  const sourceLeaf = findNotesSplitLeafById(tree, sourceLeafId);
  if (!sourceLeaf) {
    return tree;
  }

  const prunedTree = pruneNotesSplitLeafById(tree, sourceLeafId);
  if (!prunedTree || !hasNotesSplitLeaf(prunedTree, targetLeafId)) {
    return tree;
  }

  return insertNotesSplitLeaf(prunedTree, targetLeafId, sourceLeaf, direction, splitId);
}

export function resizeNotesSplitPaneTree(
  tree: NotesSplitPaneTree,
  splitId: string,
  ratio: number,
): NotesSplitPaneTree {
  if (tree.type !== 'split') {
    return tree;
  }

  if (tree.id === splitId) {
    return {
      ...tree,
      ratio: clampNotesSplitRatio(ratio),
    };
  }

  const nextFirst = resizeNotesSplitPaneTree(tree.first, splitId, ratio);
  const nextSecond = resizeNotesSplitPaneTree(tree.second, splitId, ratio);
  if (nextFirst === tree.first && nextSecond === tree.second) {
    return tree;
  }

  return {
    ...tree,
    first: nextFirst,
    second: nextSecond,
  };
}

export function pruneNotesSplitPaneTree(
  tree: NotesSplitPaneTree,
  shouldRemovePreview: (leaf: NotesSplitPreviewLeaf) => boolean,
): NotesSplitPaneTree | null {
  if (tree.type === 'primary') {
    return tree;
  }

  if (tree.type === 'preview') {
    return shouldRemovePreview(tree) ? null : tree;
  }

  const nextFirst = pruneNotesSplitPaneTree(tree.first, shouldRemovePreview);
  const nextSecond = pruneNotesSplitPaneTree(tree.second, shouldRemovePreview);

  if (nextFirst && nextSecond) {
    if (nextFirst === tree.first && nextSecond === tree.second) {
      return tree;
    }

    return {
      ...tree,
      first: nextFirst,
      second: nextSecond,
    };
  }

  return nextFirst ?? nextSecond;
}
