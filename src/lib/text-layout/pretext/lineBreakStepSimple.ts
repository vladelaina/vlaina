import { getEngineProfile } from './measurement.js'
import { breaksAfter } from './lineBreakHelpers'
import type { LineBreakCursor, PreparedLineBreakData } from './lineBreakTypes'

export function stepPreparedSimpleLineGeometry(
  prepared: PreparedLineBreakData,
  cursor: LineBreakCursor,
  maxWidth: number,
): number | null {
  const { widths, kinds, breakableFitAdvances } = prepared
  const engineProfile = getEngineProfile()
  const lineFitEpsilon = engineProfile.lineFitEpsilon
  const fitLimit = maxWidth + lineFitEpsilon

  let lineW = 0
  let hasContent = false
  let lineEndSegmentIndex = cursor.segmentIndex
  let lineEndGraphemeIndex = cursor.graphemeIndex
  let pendingBreakSegmentIndex = -1
  let pendingBreakPaintWidth = 0

  for (let i = cursor.segmentIndex; i < widths.length; i++) {
    const kind = kinds[i]!
    const breakAfter = breaksAfter(kind)
    const startGraphemeIndex = i === cursor.segmentIndex ? cursor.graphemeIndex : 0
    const breakableFitAdvance = breakableFitAdvances[i]
    const w = widths[i]!

    if (!hasContent) {
      if (startGraphemeIndex > 0 || (w > fitLimit && breakableFitAdvance !== null)) {
        const fitAdvances = breakableFitAdvance!
        const firstGraphemeWidth = fitAdvances[startGraphemeIndex]!

        hasContent = true
        lineW = firstGraphemeWidth
        lineEndSegmentIndex = i
        lineEndGraphemeIndex = startGraphemeIndex + 1

        for (let g = startGraphemeIndex + 1; g < fitAdvances.length; g++) {
          const gw = fitAdvances[g]!
          if (lineW + gw > fitLimit) {
            cursor.segmentIndex = lineEndSegmentIndex
            cursor.graphemeIndex = lineEndGraphemeIndex
            return lineW
          }
          lineW += gw
          lineEndSegmentIndex = i
          lineEndGraphemeIndex = g + 1
        }

        if (lineEndSegmentIndex === i && lineEndGraphemeIndex === fitAdvances.length) {
          lineEndSegmentIndex = i + 1
          lineEndGraphemeIndex = 0
        }
      } else {
        hasContent = true
        lineW = w
        lineEndSegmentIndex = i + 1
        lineEndGraphemeIndex = 0
      }
      if (breakAfter) {
        pendingBreakSegmentIndex = i + 1
        pendingBreakPaintWidth = lineW - w
      }
      continue
    }

    if (lineW + w > fitLimit) {
      if (breakAfter) {
        cursor.segmentIndex = i + 1
        cursor.graphemeIndex = 0
        return lineW
      }

      if (pendingBreakSegmentIndex >= 0) {
        if (
          lineEndSegmentIndex > pendingBreakSegmentIndex ||
          (lineEndSegmentIndex === pendingBreakSegmentIndex && lineEndGraphemeIndex > 0)
        ) {
          cursor.segmentIndex = lineEndSegmentIndex
          cursor.graphemeIndex = lineEndGraphemeIndex
          return lineW
        }
        cursor.segmentIndex = pendingBreakSegmentIndex
        cursor.graphemeIndex = 0
        return pendingBreakPaintWidth
      }

      cursor.segmentIndex = lineEndSegmentIndex
      cursor.graphemeIndex = lineEndGraphemeIndex
      return lineW
    }

    lineW += w
    lineEndSegmentIndex = i + 1
    lineEndGraphemeIndex = 0
    if (breakAfter) {
      pendingBreakSegmentIndex = i + 1
      pendingBreakPaintWidth = lineW - w
    }
  }

  if (!hasContent) return null
  cursor.segmentIndex = lineEndSegmentIndex
  cursor.graphemeIndex = lineEndGraphemeIndex
  return lineW
}
