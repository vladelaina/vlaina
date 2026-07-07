import type { SegmentBreakKind } from './analysis.js'
import { getEngineProfile } from './measurement.js'
import {
  breaksAfter,
  fitSoftHyphenBreak,
  getBreakOpportunityFitContribution,
  getBreakableCandidateFitWidth,
  getBreakableGraphemeAdvance,
  getLeadingLetterSpacing,
  getLineEndPaintContribution,
  getTabAdvance,
  getWholeSegmentFitContribution,
} from './lineBreakHelpers'
import type { LineBreakCursor, PreparedLineBreakData } from './lineBreakTypes'

export function stepPreparedChunkLineGeometry(
  prepared: PreparedLineBreakData,
  cursor: LineBreakCursor,
  chunkIndex: number,
  maxWidth: number,
): number | null {
  const chunk = prepared.chunks[chunkIndex]!
  if (chunk.startSegmentIndex === chunk.endSegmentIndex) {
    cursor.segmentIndex = chunk.consumedEndSegmentIndex
    cursor.graphemeIndex = 0
    return 0
  }

  const {
    widths,
    kinds,
    breakableFitAdvances,
    discretionaryHyphenWidth,
  } = prepared
  const engineProfile = getEngineProfile()
  const lineFitEpsilon = engineProfile.lineFitEpsilon
  const fitLimit = maxWidth + lineFitEpsilon

  let lineW = 0
  let hasContent = false
  let lineEndSegmentIndex = cursor.segmentIndex
  let lineEndGraphemeIndex = cursor.graphemeIndex
  let pendingBreakSegmentIndex = -1
  let pendingBreakFitWidth = 0
  let pendingBreakPaintWidth = 0
  let pendingBreakKind: SegmentBreakKind | null = null

  function clearPendingBreak(): void {
    pendingBreakSegmentIndex = -1
    pendingBreakFitWidth = 0
    pendingBreakPaintWidth = 0
    pendingBreakKind = null
  }

  function finishLine(
    endSegmentIndex = lineEndSegmentIndex,
    endGraphemeIndex = lineEndGraphemeIndex,
    width = lineW,
  ): number | null {
    if (!hasContent) return null
    cursor.segmentIndex = endSegmentIndex
    cursor.graphemeIndex = endGraphemeIndex
    return width
  }

  function startLineAtSegment(segmentIndex: number, width: number): void {
    hasContent = true
    lineEndSegmentIndex = segmentIndex + 1
    lineEndGraphemeIndex = 0
    lineW = width
  }

  function startLineAtGrapheme(segmentIndex: number, graphemeIndex: number, width: number): void {
    hasContent = true
    lineEndSegmentIndex = segmentIndex
    lineEndGraphemeIndex = graphemeIndex + 1
    lineW = width
  }

  function appendWholeSegment(segmentIndex: number, advance: number): void {
    if (!hasContent) {
      startLineAtSegment(segmentIndex, advance)
      return
    }
    lineW += advance
    lineEndSegmentIndex = segmentIndex + 1
    lineEndGraphemeIndex = 0
  }

  function updatePendingBreakForWholeSegment(
    kind: SegmentBreakKind,
    breakAfter: boolean,
    segmentIndex: number,
    segmentWidth: number,
    leadingSpacing: number,
    advance: number,
  ): void {
    if (!breakAfter) return
    const fitAdvance = getBreakOpportunityFitContribution(prepared, kind, segmentIndex, leadingSpacing)
    const paintAdvance = getLineEndPaintContribution(prepared, kind, segmentIndex, leadingSpacing, segmentWidth)
    pendingBreakSegmentIndex = segmentIndex + 1
    pendingBreakFitWidth = lineW - advance + fitAdvance
    pendingBreakPaintWidth = lineW - advance + paintAdvance
    pendingBreakKind = kind
  }

  function appendBreakableSegmentFrom(segmentIndex: number, startGraphemeIndex: number): number | null {
    const fitAdvances = breakableFitAdvances[segmentIndex]!

    for (let g = startGraphemeIndex; g < fitAdvances.length; g++) {
      const baseGw = fitAdvances[g]!

      if (!hasContent) {
        startLineAtGrapheme(segmentIndex, g, baseGw)
      } else {
        const gw = getBreakableGraphemeAdvance(prepared, true, baseGw)
        const candidatePaintWidth = lineW + gw
        if (getBreakableCandidateFitWidth(prepared, candidatePaintWidth) > fitLimit) {
          return finishLine()
        }

        lineW = candidatePaintWidth
        lineEndSegmentIndex = segmentIndex
        lineEndGraphemeIndex = g + 1
      }
    }

    if (hasContent && lineEndSegmentIndex === segmentIndex && lineEndGraphemeIndex === fitAdvances.length) {
      lineEndSegmentIndex = segmentIndex + 1
      lineEndGraphemeIndex = 0
    }
    return null
  }

  function maybeFinishAtSoftHyphen(segmentIndex: number): number | null {
    if (pendingBreakKind !== 'soft-hyphen' || pendingBreakSegmentIndex < 0) return null

    const fitWidths = breakableFitAdvances[segmentIndex] ?? null
    if (fitWidths !== null) {
      const { fitCount, fittedWidth } = fitSoftHyphenBreak(
        fitWidths,
        lineW,
        maxWidth,
        lineFitEpsilon,
        discretionaryHyphenWidth,
        prepared.letterSpacing,
      )

      if (fitCount === fitWidths.length) {
        lineW = fittedWidth
        lineEndSegmentIndex = segmentIndex + 1
        lineEndGraphemeIndex = 0
        clearPendingBreak()
        return null
      }

      if (fitCount > 0) {
        return finishLine(
          segmentIndex,
          fitCount,
          fittedWidth + discretionaryHyphenWidth,
        )
      }
    }

    if (pendingBreakFitWidth <= fitLimit) {
      return finishLine(pendingBreakSegmentIndex, 0, pendingBreakPaintWidth)
    }

    return null
  }

  for (let i = cursor.segmentIndex; i < chunk.endSegmentIndex; i++) {
    const kind = kinds[i]!
    const breakAfter = breaksAfter(kind)
    const startGraphemeIndex = i === cursor.segmentIndex ? cursor.graphemeIndex : 0
    const leadingSpacing = getLeadingLetterSpacing(prepared, hasContent, i)
    const w = kind === 'tab'
      ? getTabAdvance(lineW + leadingSpacing, prepared.tabStopAdvance)
      : widths[i]!
    const advance = leadingSpacing + w
    const fitAdvance = getWholeSegmentFitContribution(prepared, kind, i, leadingSpacing, w)

    if (kind === 'soft-hyphen' && startGraphemeIndex === 0) {
      if (hasContent) {
        lineEndSegmentIndex = i + 1
        lineEndGraphemeIndex = 0
        pendingBreakSegmentIndex = i + 1
        pendingBreakFitWidth = lineW + discretionaryHyphenWidth
        pendingBreakPaintWidth = lineW + discretionaryHyphenWidth
        pendingBreakKind = kind
      }
      continue
    }

    if (!hasContent) {
      if (startGraphemeIndex > 0) {
        const line = appendBreakableSegmentFrom(i, startGraphemeIndex)
        if (line !== null) return line
      } else if (fitAdvance > fitLimit && breakableFitAdvances[i] !== null) {
        const line = appendBreakableSegmentFrom(i, 0)
        if (line !== null) return line
      } else {
        startLineAtSegment(i, w)
      }
      updatePendingBreakForWholeSegment(kind, breakAfter, i, w, leadingSpacing, advance)
      continue
    }

    const newFitW = lineW + fitAdvance
    if (newFitW > fitLimit) {
      const currentBreakFitWidth =
        lineW + getBreakOpportunityFitContribution(prepared, kind, i, leadingSpacing)
      const currentBreakPaintWidth =
        lineW + getLineEndPaintContribution(prepared, kind, i, leadingSpacing, w)

      if (
        pendingBreakKind === 'soft-hyphen' &&
        engineProfile.preferEarlySoftHyphenBreak &&
        pendingBreakFitWidth <= fitLimit
      ) {
        return finishLine(pendingBreakSegmentIndex, 0, pendingBreakPaintWidth)
      }

      const softBreakLine = maybeFinishAtSoftHyphen(i)
      if (softBreakLine !== null) return softBreakLine

      if (breakAfter && currentBreakFitWidth <= fitLimit) {
        appendWholeSegment(i, advance)
        return finishLine(i + 1, 0, currentBreakPaintWidth)
      }

      if (pendingBreakSegmentIndex >= 0 && pendingBreakFitWidth <= fitLimit) {
        if (
          lineEndSegmentIndex > pendingBreakSegmentIndex ||
          (lineEndSegmentIndex === pendingBreakSegmentIndex && lineEndGraphemeIndex > 0)
        ) {
          return finishLine()
        }
        return finishLine(pendingBreakSegmentIndex, 0, pendingBreakPaintWidth)
      }

      if (fitAdvance > fitLimit && breakableFitAdvances[i] !== null) {
        const currentLine = finishLine()
        if (currentLine !== null) return currentLine
        const line = appendBreakableSegmentFrom(i, 0)
        if (line !== null) return line
      }

      return finishLine()
    }

    appendWholeSegment(i, advance)
    updatePendingBreakForWholeSegment(kind, breakAfter, i, w, leadingSpacing, advance)
  }

  if (pendingBreakSegmentIndex === chunk.consumedEndSegmentIndex && lineEndGraphemeIndex === 0) {
    return finishLine(chunk.consumedEndSegmentIndex, 0, pendingBreakPaintWidth)
  }

  return finishLine(chunk.consumedEndSegmentIndex, 0, lineW)
}
