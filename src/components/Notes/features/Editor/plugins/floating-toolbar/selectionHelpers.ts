// Selection Helper Functions
// Utilities for extracting state from editor selection

import type { EditorView } from '@milkdown/kit/prose/view';
import type { BlockType } from './types';

/**
 * Get active marks from current selection
 */
export function getActiveMarks(view: EditorView): Set<string> {
  const { state } = view;
  const { from, to, empty } = state.selection;
  const marks = new Set<string>();

  if (empty) return marks;

  state.doc.nodesBetween(from, to, (node) => {
    node.marks.forEach((mark) => {
      marks.add(mark.type.name);
    });
  });

  return marks;
}

/**
 * Get current block type from selection
 */
export function getCurrentBlockType(view: EditorView): BlockType {
  const { state } = view;
  const { $from } = state.selection;
  const parent = $from.parent;

  if (parent.type.name === 'heading') {
    const level = parent.attrs.level as number;
    return `heading${level}` as BlockType;
  }

  if (parent.type.name === 'blockquote') return 'blockquote';
  if (parent.type.name === 'code_block') return 'codeBlock';

  // Check for list context
  const grandparent = $from.node(-1);
  if (grandparent) {
    if (grandparent.type.name === 'bullet_list') return 'bulletList';
    if (grandparent.type.name === 'ordered_list') return 'orderedList';
    if (grandparent.type.name === 'task_list') return 'taskList';
  }

  return 'paragraph';
}

/**
 * Get link URL if selection contains a link
 */
export function getLinkUrl(view: EditorView): string | null {
  const { state } = view;
  const { from, to } = state.selection;
  let linkUrl: string | null = null;

  state.doc.nodesBetween(from, to, (node) => {
    const linkMark = node.marks.find((m) => m.type.name === 'link');
    if (linkMark) {
      linkUrl = linkMark.attrs.href as string;
    }
  });

  return linkUrl;
}

/**
 * Get text color from selection
 */
export function getTextColor(view: EditorView): string | null {
  const { state } = view;
  const { from, to } = state.selection;
  let color: string | null = null;

  state.doc.nodesBetween(from, to, (node) => {
    const colorMark = node.marks.find((m) => m.type.name === 'textColor');
    if (colorMark) {
      color = colorMark.attrs.color as string;
    }
  });

  return color;
}

/**
 * Get background color from selection
 */
export function getBgColor(view: EditorView): string | null {
  const { state } = view;
  const { from, to } = state.selection;
  let color: string | null = null;

  state.doc.nodesBetween(from, to, (node) => {
    const colorMark = node.marks.find((m) => m.type.name === 'bgColor');
    if (colorMark) {
      color = colorMark.attrs.color as string;
    }
  });

  return color;
}

/**
 * Calculate toolbar position based on selection
 */
export function calculatePosition(view: EditorView): { 
  x: number; 
  y: number; 
  placement: 'top' | 'bottom' 
} {
  const { state } = view;
  const { from, to } = state.selection;

  const start = view.coordsAtPos(from);
  const end = view.coordsAtPos(to);

  const x = (start.left + end.left) / 2;
  const y = start.top;

  // Check if near top of viewport
  const placement = y < 80 ? 'bottom' : 'top';
  const finalY = placement === 'top' ? start.top - 8 : end.bottom + 8;

  return { x, y: finalY, placement };
}
