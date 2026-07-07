import { stepPreparedLineGeometry, type LineBreakCursor } from './line-break.js'
import type { PreparedRichInlineItem } from './rich-inline-types.js'

function endsInsideFirstSegment(segmentIndex: number, graphemeIndex: number): boolean {
  return segmentIndex === 0 && graphemeIndex > 0
}

export function shouldWrapBeforePartialFirstSegment(args: {
  atItemStart: boolean
  gapBefore: number
  item: PreparedRichInlineItem
  lineEnd: LineBreakCursor
  lineWidth: number
  safeWidth: number
}): boolean {
  const { atItemStart, gapBefore, item, lineEnd, lineWidth, safeWidth } = args
  if (
    lineWidth <= 0 ||
    !atItemStart ||
    gapBefore <= 0 ||
    !endsInsideFirstSegment(lineEnd.segmentIndex, lineEnd.graphemeIndex)
  ) {
    return false
  }

  const freshLineEnd: LineBreakCursor = { segmentIndex: 0, graphemeIndex: 0 }
  const freshLineWidth = stepPreparedLineGeometry(
    item.prepared,
    freshLineEnd,
    Math.max(1, safeWidth - item.extraWidth),
  )

  return (
    freshLineWidth !== null &&
    (
      freshLineEnd.segmentIndex > lineEnd.segmentIndex ||
      (
        freshLineEnd.segmentIndex === lineEnd.segmentIndex &&
        freshLineEnd.graphemeIndex > lineEnd.graphemeIndex
      )
    )
  )
}
