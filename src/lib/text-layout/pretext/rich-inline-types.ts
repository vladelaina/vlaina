import type { LayoutCursor, PreparedTextWithSegments } from './layout.js'

declare const preparedRichInlineBrand: unique symbol

export type RichInlineItem = {
  text: string
  font: string
  letterSpacing?: number
  break?: 'normal' | 'never'
  extraWidth?: number
}

export type PreparedRichInline = {
  readonly [preparedRichInlineBrand]: true
}

export type RichInlineCursor = {
  itemIndex: number
  segmentIndex: number
  graphemeIndex: number
}

export type RichInlineFragment = {
  itemIndex: number
  text: string
  gapBefore: number
  occupiedWidth: number
  start: LayoutCursor
  end: LayoutCursor
}

export type RichInlineFragmentRange = {
  itemIndex: number
  gapBefore: number
  occupiedWidth: number
  start: LayoutCursor
  end: LayoutCursor
}

export type RichInlineLine = {
  fragments: RichInlineFragment[]
  width: number
  end: RichInlineCursor
}

export type RichInlineLineRange = {
  fragments: RichInlineFragmentRange[]
  width: number
  end: RichInlineCursor
}

export type RichInlineStats = {
  lineCount: number
  maxLineWidth: number
}

export type InternalPreparedRichInline = PreparedRichInline & {
  items: PreparedRichInlineItem[]
  itemsBySourceItemIndex: Array<PreparedRichInlineItem | undefined>
}

export type PreparedRichInlineItem = {
  break: 'normal' | 'never'
  endGraphemeIndex: number
  endSegmentIndex: number
  extraWidth: number
  gapBefore: number
  naturalWidth: number
  prepared: PreparedTextWithSegments
  sourceItemIndex: number
}

export const EMPTY_LAYOUT_CURSOR: LayoutCursor = { segmentIndex: 0, graphemeIndex: 0 }
export const RICH_INLINE_START_CURSOR: RichInlineCursor = {
  itemIndex: 0,
  segmentIndex: 0,
  graphemeIndex: 0,
}

export function getInternalPreparedRichInline(prepared: PreparedRichInline): InternalPreparedRichInline {
  return prepared as InternalPreparedRichInline
}

export function cloneCursor(cursor: LayoutCursor): LayoutCursor {
  return {
    segmentIndex: cursor.segmentIndex,
    graphemeIndex: cursor.graphemeIndex,
  }
}

export function isLineStartCursor(cursor: LayoutCursor): boolean {
  return cursor.segmentIndex === 0 && cursor.graphemeIndex === 0
}
