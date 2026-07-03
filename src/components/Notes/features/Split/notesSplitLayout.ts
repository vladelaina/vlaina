export type NotesSplitDirection = 'left' | 'right' | 'top' | 'bottom';
export type NotesSplitOrientation = 'horizontal' | 'vertical';

export interface NotesSplitPrimaryLeaf {
  type: 'primary';
  id: string;
}

export interface NotesSplitPreviewLeaf {
  type: 'preview';
  id: string;
  path: string;
  requiresOpenTab: boolean;
}

export interface NotesSplitNode {
  type: 'split';
  id: string;
  direction: NotesSplitDirection;
  orientation: NotesSplitOrientation;
  ratio: number;
  first: NotesSplitPaneTree;
  second: NotesSplitPaneTree;
}

export type NotesSplitPaneTree = NotesSplitPrimaryLeaf | NotesSplitPreviewLeaf | NotesSplitNode;
export type NotesSplitLeaf = NotesSplitPrimaryLeaf | NotesSplitPreviewLeaf;

export interface NotesSplitRect {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
}

const SPLIT_EDGE_THRESHOLD = 0.28;
export const NOTES_SPLIT_PRIMARY_LEAF_ID = 'primary';
export const NOTES_SPLIT_DEFAULT_RATIO = 0.5;
export const NOTES_SPLIT_MIN_RATIO = 0.18;
export const NOTES_SPLIT_MAX_RATIO = 0.82;

export function resolveNotesSplitDropDirection(
  rect: NotesSplitRect,
  point: { clientX: number; clientY: number }
): NotesSplitDirection | null {
  if (
    rect.width <= 0 ||
    rect.height <= 0 ||
    point.clientX < rect.left ||
    point.clientX > rect.right ||
    point.clientY < rect.top ||
    point.clientY > rect.bottom
  ) {
    return null;
  }

  const candidates: Array<{ direction: NotesSplitDirection; distance: number }> = [
    { direction: 'left', distance: (point.clientX - rect.left) / rect.width },
    { direction: 'right', distance: (rect.right - point.clientX) / rect.width },
    { direction: 'top', distance: (point.clientY - rect.top) / rect.height },
    { direction: 'bottom', distance: (rect.bottom - point.clientY) / rect.height },
  ];
  const nearest = candidates.reduce((best, candidate) => (
    candidate.distance < best.distance ? candidate : best
  ));

  return nearest.distance <= SPLIT_EDGE_THRESHOLD ? nearest.direction : null;
}

export function isVerticalNotesSplit(direction: NotesSplitDirection): boolean {
  return direction === 'left' || direction === 'right';
}

export function getNotesSplitOrientation(direction: NotesSplitDirection): NotesSplitOrientation {
  return isVerticalNotesSplit(direction) ? 'horizontal' : 'vertical';
}

export function createInitialNotesSplitPaneTree(): NotesSplitPaneTree {
  return {
    type: 'primary',
    id: NOTES_SPLIT_PRIMARY_LEAF_ID,
  };
}

export function clampNotesSplitRatio(ratio: number): number {
  if (!Number.isFinite(ratio)) {
    return NOTES_SPLIT_DEFAULT_RATIO;
  }

  return Math.min(Math.max(ratio, NOTES_SPLIT_MIN_RATIO), NOTES_SPLIT_MAX_RATIO);
}

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
