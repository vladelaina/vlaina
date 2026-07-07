import type { SegmentBreakKind } from './analysis.js'
import { getEngineProfile } from './measurement.js'
import { breaksAfter, fitSoftHyphenBreak, getBreakOpportunityFitContribution, getBreakableCandidateFitWidth, getBreakableGraphemeAdvance, getLeadingLetterSpacing, getLineEndPaintContribution, getTabAdvance, getWholeSegmentFitContribution, normalizeLineStartSegmentIndex } from './lineBreakHelpers'
import { walkPreparedLinesSimple } from './lineBreakSimpleWalk'
import type { InternalLineVisitor, PreparedLineBreakData } from './lineBreakTypes'

export function walkPreparedLinesRaw(prepared: PreparedLineBreakData, maxWidth: number, onLine?: InternalLineVisitor): number {
  if (prepared.simpleLineWalkFastPath) {
    return walkPreparedLinesSimple(prepared, maxWidth, onLine)
  }

  const {
    widths,
    kinds,
    breakableFitAdvances,
    discretionaryHyphenWidth,
    chunks,
  } = prepared
  if (widths.length === 0 || chunks.length === 0) return 0

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
  let pendingBreakFitWidth = 0
  let pendingBreakPaintWidth = 0
  let pendingBreakKind: SegmentBreakKind | null = null

  function clearPendingBreak(): void {
    pendingBreakSegmentIndex = -1
    pendingBreakFitWidth = 0
    pendingBreakPaintWidth = 0
    pendingBreakKind = null
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

  function appendBreakableSegmentFrom(segmentIndex: number, startGraphemeIndex: number): void {
    const fitAdvances = breakableFitAdvances[segmentIndex]!

    for (let g = startGraphemeIndex; g < fitAdvances.length; g++) {
      const baseGw = fitAdvances[g]!

      if (!hasContent) {
        startLineAtGrapheme(segmentIndex, g, baseGw)
      } else {
        const gw = getBreakableGraphemeAdvance(prepared, true, baseGw)
        const candidatePaintWidth = lineW + gw
        if (getBreakableCandidateFitWidth(prepared, candidatePaintWidth) > fitLimit) {
          emitCurrentLine()
          startLineAtGrapheme(segmentIndex, g, baseGw)
        } else {
          lineW = candidatePaintWidth
          lineEndSegmentIndex = segmentIndex
          lineEndGraphemeIndex = g + 1
        }
      }
    }

    if (hasContent && lineEndSegmentIndex === segmentIndex && lineEndGraphemeIndex === fitAdvances.length) {
      lineEndSegmentIndex = segmentIndex + 1
      lineEndGraphemeIndex = 0
    }
  }

  function continueSoftHyphenBreakableSegment(segmentIndex: number): boolean {
    if (pendingBreakKind !== 'soft-hyphen') return false
    const fitWidths = breakableFitAdvances[segmentIndex]
    if (fitWidths == null) return false
    const { fitCount, fittedWidth } = fitSoftHyphenBreak(
      fitWidths,
      lineW,
      maxWidth,
      lineFitEpsilon,
      discretionaryHyphenWidth,
      prepared.letterSpacing,
    )
    if (fitCount === 0) return false

    lineW = fittedWidth
    lineEndSegmentIndex = segmentIndex
    lineEndGraphemeIndex = fitCount
    clearPendingBreak()

    if (fitCount === fitWidths.length) {
      lineEndSegmentIndex = segmentIndex + 1
      lineEndGraphemeIndex = 0
      return true
    }

    emitCurrentLine(
      segmentIndex,
      fitCount,
      fittedWidth + discretionaryHyphenWidth,
    )
    appendBreakableSegmentFrom(segmentIndex, fitCount)
    return true
  }

  function emitEmptyChunk(chunk: { startSegmentIndex: number, consumedEndSegmentIndex: number }): void {
    lineCount++
    onLine?.(0, chunk.startSegmentIndex, 0, chunk.consumedEndSegmentIndex, 0)
    clearPendingBreak()
  }

  for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
    const chunk = chunks[chunkIndex]!
    if (chunk.startSegmentIndex === chunk.endSegmentIndex) {
      emitEmptyChunk(chunk)
      continue
    }

    hasContent = false
    lineW = 0
    lineStartSegmentIndex = chunk.startSegmentIndex
    lineStartGraphemeIndex = 0
    lineEndSegmentIndex = chunk.startSegmentIndex
    lineEndGraphemeIndex = 0
    clearPendingBreak()

    let i = chunk.startSegmentIndex
    while (i < chunk.endSegmentIndex) {
      if (!hasContent) {
        i = normalizeLineStartSegmentIndex(prepared, i, chunk.endSegmentIndex)
        if (i >= chunk.endSegmentIndex) break
      }

      const kind = kinds[i]!
      const breakAfter = breaksAfter(kind)
      const leadingSpacing = getLeadingLetterSpacing(prepared, hasContent, i)
      const w = kind === 'tab'
        ? getTabAdvance(lineW + leadingSpacing, prepared.tabStopAdvance)
        : widths[i]!
      const advance = leadingSpacing + w
      const fitAdvance = getWholeSegmentFitContribution(prepared, kind, i, leadingSpacing, w)

      if (kind === 'soft-hyphen') {
        if (hasContent) {
          lineEndSegmentIndex = i + 1
          lineEndGraphemeIndex = 0
          pendingBreakSegmentIndex = i + 1
          pendingBreakFitWidth = lineW + discretionaryHyphenWidth
          pendingBreakPaintWidth = lineW + discretionaryHyphenWidth
          pendingBreakKind = kind
        }
        i++
        continue
      }

      if (!hasContent) {
        if (fitAdvance > fitLimit && breakableFitAdvances[i] !== null) {
          appendBreakableSegmentFrom(i, 0)
        } else {
          startLineAtSegment(i, w)
        }
        updatePendingBreakForWholeSegment(kind, breakAfter, i, w, leadingSpacing, advance)
        i++
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
          emitCurrentLine(pendingBreakSegmentIndex, 0, pendingBreakPaintWidth)
          continue
        }

        if (pendingBreakKind === 'soft-hyphen' && continueSoftHyphenBreakableSegment(i)) {
          i++
          continue
        }

        if (breakAfter && currentBreakFitWidth <= fitLimit) {
          appendWholeSegment(i, advance)
          emitCurrentLine(i + 1, 0, currentBreakPaintWidth)
          i++
          continue
        }

        if (pendingBreakSegmentIndex >= 0 && pendingBreakFitWidth <= fitLimit) {
          if (
            lineEndSegmentIndex > pendingBreakSegmentIndex ||
            (lineEndSegmentIndex === pendingBreakSegmentIndex && lineEndGraphemeIndex > 0)
          ) {
            emitCurrentLine()
            continue
          }
          const nextSegmentIndex = pendingBreakSegmentIndex
          emitCurrentLine(nextSegmentIndex, 0, pendingBreakPaintWidth)
          i = nextSegmentIndex
          continue
        }

        if (fitAdvance > fitLimit && breakableFitAdvances[i] !== null) {
          emitCurrentLine()
          appendBreakableSegmentFrom(i, 0)
          i++
          continue
        }

        emitCurrentLine()
        continue
      }

      appendWholeSegment(i, advance)
      updatePendingBreakForWholeSegment(kind, breakAfter, i, w, leadingSpacing, advance)
      i++
    }

    if (hasContent) {
      const finalPaintWidth =
        pendingBreakSegmentIndex === chunk.consumedEndSegmentIndex
          ? pendingBreakPaintWidth
          : lineW
      emitCurrentLine(chunk.consumedEndSegmentIndex, 0, finalPaintWidth)
    }
  }

  return lineCount
}
