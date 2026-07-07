import type { EditorView } from '@milkdown/kit/prose/view';

export const LINE_FILL_LAYER_CLASS = 'editor-block-selection-line-fill-layer';
export const LINE_FILL_CLASS = 'editor-block-selection-line-fill';
export const ROW_MERGE_TOLERANCE_PX = 2;
export const FALLBACK_BLOCK_SELECTION_BLEED_X_PX = 72;
export const FALLBACK_BLOCK_SELECTION_BLEED_Y_PX = 2;
export const LINE_FILL_VIEWPORT_OVERSCAN_PX = 600;
export const MAX_BLOCK_SELECTION_LINE_FILL_RANGES = 512;
export const MAX_BLOCK_SELECTION_LINE_FILL_ROWS_PER_RANGE = 128;
export const MAX_BLOCK_SELECTION_LINE_FILL_ELEMENTS = 1024;
export const MAX_BLOCK_SELECTION_LINE_FILL_DOM_RECTS = 1024;
export const BLOCK_SELECTION_PENDING_CLASS = 'editor-block-selection-pending';
export const SELECTED_IMAGE_BLOCK_SELECTOR = '.image-block-container.editor-block-selected';

export interface LineFillOverlay {
  update: (view: EditorView) => void;
  destroy: () => void;
}

export interface RowRect {
  top: number;
  right: number;
  bottom: number;
}

export interface LineFillEdges {
  top: number;
  bottom: number;
}

export interface ProseNodeLike {
  type: { name: string };
  attrs?: Record<string, unknown>;
  nodeSize: number;
  childCount: number;
  child: (index: number) => ProseNodeLike;
}

export function isHardBreakNodeName(name: string): boolean {
  return name === 'hardbreak' || name === 'hard_break';
}
