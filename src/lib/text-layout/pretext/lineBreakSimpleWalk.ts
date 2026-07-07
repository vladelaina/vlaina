import { getEngineProfile } from './measurement.js'
import {
  breaksAfter,
  normalizeLineStartSegmentIndex,
} from './lineBreakHelpers'
import type { InternalLineVisitor, PreparedLineBreakData } from './lineBreakTypes'

export function walkPreparedLinesSimple(
  prepared: PreparedLineBreakData,
  maxWidth: number,
  onLine?: InternalLineVisitor,
): number {
  const { widths, kinds, breakableFitAdvances } = prepared
  if (widths.length === 0) return 0

  const engineProfile = getEngineProfile()
  const lineFitEpsilon = engineProfile.lineFitEpsilon
  const fitLimit = maxWidth + lineFitEpsilon

  let lineCount = 0
  let lineW = 0
  let hasContent = false
  let lineStartSegmentIndex = 0
  let lineStartGraphemeIndex = 0
  let lineEndSegmentIndex = 0
  let lineEndGraphemeIndex = 0
  let pendingBreakSegmentIndex = -1
  let pendingBreakPaintWidth = 0

  function clearPendingBreak(): void {
    pendingBreakSegmentIndex = -1
    pendingBreakPaintWidth = 0
  }

  function emitCurrentLine(
    endSegmentIndex = lineEndSegmentIndex,
    endGraphemeIndex = lineEndGraphemeIndex,
    width = lineW,
  ): void {
    lineCount++
    onLine?.(
      width,
      lineStartSegmentIndex,
      lineStartGraphemeIndex,
      endSegmentIndex,
      endGraphemeIndex,
    )
    lineW = 0
    hasContent = false
    clearPendingBreak()
  }

  function startLineAtSegment(segmentIndex: number, width: number): void {
    hasContent = true
    lineStartSegmentIndex = segmentIndex
    lineStartGraphemeIndex = 0
    lineEndSegmentIndex = segmentIndex + 1
    lineEndGraphemeIndex = 0
    lineW = width
  }

  function startLineAtGrapheme(segmentIndex: number, graphemeIndex: number, width: number): void {
    hasContent = true
    lineStartSegmentIndex = segmentIndex
    lineStartGraphemeIndex = graphemeIndex
    lineEndSegmentIndex = segmentIndex
    lineEndGraphemeIndex = graphemeIndex + 1
    lineW = width
  }

  function appendWholeSegment(segmentIndex: number, width: number): void {
    if (!hasContent) {
      startLineAtSegment(segmentIndex, width)
      return
    }
    lineW += width
    lineEndSegmentIndex = segmentIndex + 1
    lineEndGraphemeIndex = 0
  }

  function appendBreakableSegmentFrom(segmentIndex: number, startGraphemeIndex: number): void {
    const fitAdvances = breakableFitAdvances[segmentIndex]!

    for (let g = startGraphemeIndex; g < fitAdvances.length; g++) {
      const gw = fitAdvances[g]!

      if (!hasContent) {
        startLineAtGrapheme(segmentIndex, g, gw)
      } else if (lineW + gw > fitLimit) {
        emitCurrentLine()
        startLineAtGrapheme(segmentIndex, g, gw)
      } else {
        lineW += gw
        lineEndSegmentIndex = segmentIndex
        lineEndGraphemeIndex = g + 1
      }
    }

    if (hasContent && lineEndSegmentIndex === segmentIndex && lineEndGraphemeIndex === fitAdvances.length) {
      lineEndSegmentIndex = segmentIndex + 1
      lineEndGraphemeIndex = 0
    }
  }

  let i = 0
  while (i < widths.length) {
    if (!hasContent) {
      i = normalizeLineStartSegmentIndex(prepared, i)
      if (i >= widths.length) break
    }

    const w = widths[i]!
    const kind = kinds[i]!
    const breakAfter = breaksAfter(kind)

    if (!hasContent) {
      if (w > fitLimit && breakableFitAdvances[i] !== null) {
        appendBreakableSegmentFrom(i, 0)
      } else {
        startLineAtSegment(i, w)
      }
      if (breakAfter) {
        pendingBreakSegmentIndex = i + 1
        pendingBreakPaintWidth = lineW - w
      }
      i++
      continue
    }

    const newW = lineW + w
    if (newW > fitLimit) {
      if (breakAfter) {
        appendWholeSegment(i, w)
        emitCurrentLine(i + 1, 0, lineW - w)
        i++
        continue
      }

      if (pendingBreakSegmentIndex >= 0) {
        if (
          lineEndSegmentIndex > pendingBreakSegmentIndex ||
          (lineEndSegmentIndex === pendingBreakSegmentIndex && lineEndGraphemeIndex > 0)
        ) {
          emitCurrentLine()
          continue
        }
        emitCurrentLine(pendingBreakSegmentIndex, 0, pendingBreakPaintWidth)
        continue
      }

      if (w > fitLimit && breakableFitAdvances[i] !== null) {
        emitCurrentLine()
        appendBreakableSegmentFrom(i, 0)
        i++
        continue
      }

      emitCurrentLine()
      continue
    }

    appendWholeSegment(i, w)
    if (breakAfter) {
      pendingBreakSegmentIndex = i + 1
      pendingBreakPaintWidth = lineW - w
    }
    i++
  }

  if (hasContent) emitCurrentLine()
  return lineCount
}
