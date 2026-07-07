import { stepPreparedLineGeometry, type LineBreakCursor } from './line-break.js'
import {
  cloneCursor,
  EMPTY_LAYOUT_CURSOR,
  isLineStartCursor,
  type InternalPreparedRichInline,
  type PreparedRichInlineItem,
  type RichInlineCursor,
} from './rich-inline-types.js'
import { shouldWrapBeforePartialFirstSegment } from './rich-inline-wrap.js'

type RichInlineFragmentCollector = (
  item: PreparedRichInlineItem,
  gapBefore: number,
  occupiedWidth: number,
  start: LineBreakCursor,
  end: LineBreakCursor,
) => void

export function stepRichInlineLine(
  flow: InternalPreparedRichInline,
  maxWidth: number,
  cursor: RichInlineCursor,
  collectFragment?: RichInlineFragmentCollector,
): number | null {
  if (flow.items.length === 0 || cursor.itemIndex >= flow.items.length) return null

  const safeWidth = Math.max(1, maxWidth)
  let lineWidth = 0
  let remainingWidth = safeWidth
  let itemIndex = cursor.itemIndex
  const textCursor: LineBreakCursor = {
    segmentIndex: cursor.segmentIndex,
    graphemeIndex: cursor.graphemeIndex,
  }

  lineLoop:
  while (itemIndex < flow.items.length) {
    const item = flow.items[itemIndex]!
    if (
      !isLineStartCursor(textCursor) &&
      textCursor.segmentIndex === item.endSegmentIndex &&
      textCursor.graphemeIndex === item.endGraphemeIndex
    ) {
      itemIndex++
      textCursor.segmentIndex = 0
      textCursor.graphemeIndex = 0
      continue
    }

    const gapBefore = lineWidth === 0 ? 0 : item.gapBefore
    const atItemStart = isLineStartCursor(textCursor)

    if (item.break === 'never') {
      if (!atItemStart) {
        itemIndex++
        textCursor.segmentIndex = 0
        textCursor.graphemeIndex = 0
        continue
      }

      const occupiedWidth = item.naturalWidth + item.extraWidth
      const totalWidth = gapBefore + occupiedWidth
      if (lineWidth > 0 && totalWidth > remainingWidth) break lineLoop

      collectFragment?.(
        item,
        gapBefore,
        occupiedWidth,
        cloneCursor(EMPTY_LAYOUT_CURSOR),
        {
          segmentIndex: item.endSegmentIndex,
          graphemeIndex: item.endGraphemeIndex,
        },
      )
      lineWidth += totalWidth
      remainingWidth = Math.max(0, safeWidth - lineWidth)
      itemIndex++
      textCursor.segmentIndex = 0
      textCursor.graphemeIndex = 0
      continue
    }

    const reservedWidth = gapBefore + item.extraWidth
    if (lineWidth > 0 && reservedWidth >= remainingWidth) break lineLoop

    if (atItemStart) {
      const totalWidth = reservedWidth + item.naturalWidth
      if (totalWidth <= remainingWidth) {
        collectFragment?.(
          item,
          gapBefore,
          item.naturalWidth + item.extraWidth,
          cloneCursor(EMPTY_LAYOUT_CURSOR),
          {
            segmentIndex: item.endSegmentIndex,
            graphemeIndex: item.endGraphemeIndex,
          },
        )
        lineWidth += totalWidth
        remainingWidth = Math.max(0, safeWidth - lineWidth)
        itemIndex++
        textCursor.segmentIndex = 0
        textCursor.graphemeIndex = 0
        continue
      }
    }

    const availableWidth = Math.max(1, remainingWidth - reservedWidth)
    const lineEnd: LineBreakCursor = {
      segmentIndex: textCursor.segmentIndex,
      graphemeIndex: textCursor.graphemeIndex,
    }
    const lineWidthForItem = stepPreparedLineGeometry(item.prepared, lineEnd, availableWidth)
    if (lineWidthForItem === null) {
      itemIndex++
      textCursor.segmentIndex = 0
      textCursor.graphemeIndex = 0
      continue
    }
    if (
      textCursor.segmentIndex === lineEnd.segmentIndex &&
      textCursor.graphemeIndex === lineEnd.graphemeIndex
    ) {
      itemIndex++
      textCursor.segmentIndex = 0
      textCursor.graphemeIndex = 0
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

    collectFragment?.(
      item,
      gapBefore,
      lineWidthForItem + item.extraWidth,
      cloneCursor(textCursor),
      {
        segmentIndex: lineEnd.segmentIndex,
        graphemeIndex: lineEnd.graphemeIndex,
      },
    )
    lineWidth += gapBefore + lineWidthForItem + item.extraWidth
    remainingWidth = Math.max(0, safeWidth - lineWidth)

    if (
      lineEnd.segmentIndex === item.endSegmentIndex &&
      lineEnd.graphemeIndex === item.endGraphemeIndex
    ) {
      itemIndex++
      textCursor.segmentIndex = 0
      textCursor.graphemeIndex = 0
      continue
    }

    textCursor.segmentIndex = lineEnd.segmentIndex
    textCursor.graphemeIndex = lineEnd.graphemeIndex
    break
  }

  if (lineWidth === 0) return null

  cursor.itemIndex = itemIndex
  cursor.segmentIndex = textCursor.segmentIndex
  cursor.graphemeIndex = textCursor.graphemeIndex
  return lineWidth
}
