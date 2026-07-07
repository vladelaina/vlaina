import { stepPreparedLineGeometry, type LineBreakCursor } from './line-break.js'
import {
  getInternalPreparedRichInline,
  isLineStartCursor,
  type InternalPreparedRichInline,
  type PreparedRichInline,
  type RichInlineCursor,
  type RichInlineStats,
} from './rich-inline-types.js'
import { shouldWrapBeforePartialFirstSegment } from './rich-inline-wrap.js'

function stepRichInlineLineStats(
  flow: InternalPreparedRichInline,
  maxWidth: number,
  cursor: RichInlineCursor,
): number | null {
  if (flow.items.length === 0 || cursor.itemIndex >= flow.items.length) return null

  const safeWidth = Math.max(1, maxWidth)
  let lineWidth = 0
  let remainingWidth = safeWidth
  let itemIndex = cursor.itemIndex

  lineLoop:
  while (itemIndex < flow.items.length) {
    const item = flow.items[itemIndex]!
    if (
      !isLineStartCursor(cursor) &&
      cursor.segmentIndex === item.endSegmentIndex &&
      cursor.graphemeIndex === item.endGraphemeIndex
    ) {
      itemIndex++
      cursor.segmentIndex = 0
      cursor.graphemeIndex = 0
      continue
    }

    const gapBefore = lineWidth === 0 ? 0 : item.gapBefore
    const atItemStart = isLineStartCursor(cursor)

    if (item.break === 'never') {
      if (!atItemStart) {
        itemIndex++
        cursor.segmentIndex = 0
        cursor.graphemeIndex = 0
        continue
      }

      const occupiedWidth = item.naturalWidth + item.extraWidth
      const totalWidth = gapBefore + occupiedWidth
      if (lineWidth > 0 && totalWidth > remainingWidth) break lineLoop

      lineWidth += totalWidth
      remainingWidth = Math.max(0, safeWidth - lineWidth)
      itemIndex++
      cursor.segmentIndex = 0
      cursor.graphemeIndex = 0
      continue
    }

    const reservedWidth = gapBefore + item.extraWidth
    if (lineWidth > 0 && reservedWidth >= remainingWidth) break lineLoop

    if (atItemStart) {
      const totalWidth = reservedWidth + item.naturalWidth
      if (totalWidth <= remainingWidth) {
        lineWidth += totalWidth
        remainingWidth = Math.max(0, safeWidth - lineWidth)
        itemIndex++
        cursor.segmentIndex = 0
        cursor.graphemeIndex = 0
        continue
      }
    }

    const availableWidth = Math.max(1, remainingWidth - reservedWidth)
    const lineEnd: LineBreakCursor = {
      segmentIndex: cursor.segmentIndex,
      graphemeIndex: cursor.graphemeIndex,
    }
    const lineWidthForItem = stepPreparedLineGeometry(item.prepared, lineEnd, availableWidth)
    if (lineWidthForItem === null) {
      itemIndex++
      cursor.segmentIndex = 0
      cursor.graphemeIndex = 0
      continue
    }
    if (cursor.segmentIndex === lineEnd.segmentIndex && cursor.graphemeIndex === lineEnd.graphemeIndex) {
      itemIndex++
      cursor.segmentIndex = 0
      cursor.graphemeIndex = 0
      continue
    }

    if (
      shouldWrapBeforePartialFirstSegment({
        atItemStart,
        gapBefore,
        item,
        lineEnd,
        lineWidth,
        safeWidth,
      })
    ) {
      break lineLoop
    }

    lineWidth += gapBefore + lineWidthForItem + item.extraWidth
    remainingWidth = Math.max(0, safeWidth - lineWidth)

    if (lineEnd.segmentIndex === item.endSegmentIndex && lineEnd.graphemeIndex === item.endGraphemeIndex) {
      itemIndex++
      cursor.segmentIndex = 0
      cursor.graphemeIndex = 0
      continue
    }

    cursor.segmentIndex = lineEnd.segmentIndex
    cursor.graphemeIndex = lineEnd.graphemeIndex
    break
  }

  if (lineWidth === 0) return null

  cursor.itemIndex = itemIndex
  return lineWidth
}

export function measureRichInlineStats(
  prepared: PreparedRichInline,
  maxWidth: number,
): RichInlineStats {
  const flow = getInternalPreparedRichInline(prepared)
  let lineCount = 0
  let maxLineWidth = 0
  const cursor: RichInlineCursor = {
    itemIndex: 0,
    segmentIndex: 0,
    graphemeIndex: 0,
  }

  while (true) {
    const lineWidth = stepRichInlineLineStats(flow, maxWidth, cursor)
    if (lineWidth === null) {
      return {
        lineCount,
        maxLineWidth,
      }
    }
    lineCount++
    if (lineWidth > maxLineWidth) maxLineWidth = lineWidth
  }
}
