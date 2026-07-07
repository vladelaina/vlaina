export interface RectBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface BlockRect extends RectBounds {
  from: number;
  to: number;
  contentLeft?: number;
  contentRight?: number;
  contentLineRects?: RectBounds[];
  allowInsideTrailingClick?: boolean;
}

export interface BlockRange {
  from: number;
  to: number;
}

export interface BlockRectYIndex {
  blocks: readonly BlockRect[];
  sortedByTop: readonly BlockRect[];
}

export const LARGE_BLOCK_SELECTION_RENDERING_THRESHOLD = 128;
