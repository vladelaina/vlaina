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

export const NOTES_SPLIT_PRIMARY_LEAF_ID = 'primary';
export const NOTES_SPLIT_DEFAULT_RATIO = 0.5;
export const NOTES_SPLIT_MIN_RATIO = 0.18;
export const NOTES_SPLIT_MAX_RATIO = 0.82;

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
