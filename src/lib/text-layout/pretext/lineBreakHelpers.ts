import type { SegmentBreakKind } from './analysis.js'
import type { LineBreakCursor, PreparedLineBreakData } from './lineBreakTypes'

export function consumesAtLineStart(kind: SegmentBreakKind): boolean {
  return kind === 'space' || kind === 'zero-width-break' || kind === 'soft-hyphen'
}

export function breaksAfter(kind: SegmentBreakKind): boolean {
  return (
    kind === 'space' ||
    kind === 'preserved-space' ||
    kind === 'tab' ||
    kind === 'zero-width-break' ||
    kind === 'soft-hyphen'
  )
}

export function normalizeLineStartSegmentIndex(
  prepared: PreparedLineBreakData,
  segmentIndex: number,
  endSegmentIndex = prepared.widths.length,
): number {
  while (segmentIndex < endSegmentIndex) {
    const kind = prepared.kinds[segmentIndex]!
    if (!consumesAtLineStart(kind)) break
    segmentIndex++
  }
  return segmentIndex
}

export function getTabAdvance(lineWidth: number, tabStopAdvance: number): number {
  if (tabStopAdvance <= 0) return 0

  const remainder = lineWidth % tabStopAdvance
  if (Math.abs(remainder) <= 1e-6) return tabStopAdvance
  return tabStopAdvance - remainder
}

export function getLeadingLetterSpacing(
  prepared: PreparedLineBreakData,
  hasContent: boolean,
  segmentIndex: number,
): number {
  return (
    prepared.letterSpacing !== 0 &&
    hasContent &&
    prepared.spacingGraphemeCounts[segmentIndex]! > 0
  )
    ? prepared.letterSpacing
    : 0
}

function getLineEndContribution(leadingSpacing: number, segmentContribution: number): number {
  return segmentContribution === 0 ? 0 : leadingSpacing + segmentContribution
}

function getTabTrailingLetterSpacing(
  prepared: PreparedLineBreakData,
  segmentIndex: number,
): number {
  return (
    prepared.letterSpacing !== 0 &&
    prepared.spacingGraphemeCounts[segmentIndex]! > 0
  )
    ? prepared.letterSpacing
    : 0
}

export function getWholeSegmentFitContribution(
  prepared: PreparedLineBreakData,
  kind: SegmentBreakKind,
  segmentIndex: number,
  leadingSpacing: number,
  segmentWidth: number,
): number {
  const segmentContribution = kind === 'tab'
    ? segmentWidth + getTabTrailingLetterSpacing(prepared, segmentIndex)
    : prepared.lineEndFitAdvances[segmentIndex]!
  return getLineEndContribution(leadingSpacing, segmentContribution)
}

export function getBreakOpportunityFitContribution(
  prepared: PreparedLineBreakData,
  kind: SegmentBreakKind,
  segmentIndex: number,
  leadingSpacing: number,
): number {
  const segmentContribution = kind === 'tab' ? 0 : prepared.lineEndFitAdvances[segmentIndex]!
  return getLineEndContribution(leadingSpacing, segmentContribution)
}

export function getLineEndPaintContribution(
  prepared: PreparedLineBreakData,
  kind: SegmentBreakKind,
  segmentIndex: number,
  leadingSpacing: number,
  segmentWidth: number,
): number {
  const segmentContribution = kind === 'tab' ? segmentWidth : prepared.lineEndPaintAdvances[segmentIndex]!
  return getLineEndContribution(leadingSpacing, segmentContribution)
}

export function getBreakableGraphemeAdvance(
  prepared: PreparedLineBreakData,
  hasContent: boolean,
  baseAdvance: number,
): number {
  return prepared.letterSpacing !== 0 && hasContent
    ? baseAdvance + prepared.letterSpacing
    : baseAdvance
}

export function getBreakableCandidateFitWidth(
  prepared: PreparedLineBreakData,
  candidatePaintWidth: number,
): number {
  return prepared.letterSpacing === 0
    ? candidatePaintWidth
    : candidatePaintWidth + prepared.letterSpacing
}

export function fitSoftHyphenBreak(
  graphemeFitAdvances: number[],
  initialWidth: number,
  maxWidth: number,
  lineFitEpsilon: number,
  discretionaryHyphenWidth: number,
  letterSpacing: number,
): { fitCount: number, fittedWidth: number } {
  let fitCount = 0
  let fittedWidth = initialWidth

  while (fitCount < graphemeFitAdvances.length) {
    const nextWidth = fittedWidth + graphemeFitAdvances[fitCount]! + letterSpacing
    const nextLineWidth = fitCount + 1 < graphemeFitAdvances.length
      ? nextWidth + discretionaryHyphenWidth
      : nextWidth
    if (nextLineWidth > maxWidth + lineFitEpsilon) break
    fittedWidth = nextWidth
    fitCount++
  }

  return { fitCount, fittedWidth }
}

function findChunkIndexForStart(prepared: PreparedLineBreakData, segmentIndex: number): number {
  let lo = 0
  let hi = prepared.chunks.length

  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2)
    if (segmentIndex < prepared.chunks[mid]!.consumedEndSegmentIndex) {
      hi = mid
    } else {
      lo = mid + 1
    }
  }

  return lo < prepared.chunks.length ? lo : -1
}

function normalizeLineStartInChunk(
  prepared: PreparedLineBreakData,
  chunkIndex: number,
  cursor: LineBreakCursor,
): number {
  let segmentIndex = cursor.segmentIndex
  if (cursor.graphemeIndex > 0) return chunkIndex

  const chunk = prepared.chunks[chunkIndex]!
  if (chunk.startSegmentIndex === chunk.endSegmentIndex && segmentIndex === chunk.startSegmentIndex) {
    cursor.segmentIndex = segmentIndex
    cursor.graphemeIndex = 0
    return chunkIndex
  }

  if (segmentIndex < chunk.startSegmentIndex) segmentIndex = chunk.startSegmentIndex
  segmentIndex = normalizeLineStartSegmentIndex(prepared, segmentIndex, chunk.endSegmentIndex)
  if (segmentIndex < chunk.endSegmentIndex) {
    cursor.segmentIndex = segmentIndex
    cursor.graphemeIndex = 0
    return chunkIndex
  }

  if (chunk.consumedEndSegmentIndex >= prepared.widths.length) return -1
  cursor.segmentIndex = chunk.consumedEndSegmentIndex
  cursor.graphemeIndex = 0
  return chunkIndex + 1
}

export function normalizeLineStartChunkIndex(
  prepared: PreparedLineBreakData,
  cursor: LineBreakCursor,
): number {
  if (cursor.segmentIndex >= prepared.widths.length) return -1

  const chunkIndex = findChunkIndexForStart(prepared, cursor.segmentIndex)
  if (chunkIndex < 0) return -1
  return normalizeLineStartInChunk(prepared, chunkIndex, cursor)
}

export function normalizeLineStartChunkIndexFromHint(
  prepared: PreparedLineBreakData,
  chunkIndex: number,
  cursor: LineBreakCursor,
): number {
  if (cursor.segmentIndex >= prepared.widths.length) return -1

  let nextChunkIndex = chunkIndex
  while (
    nextChunkIndex < prepared.chunks.length &&
    cursor.segmentIndex >= prepared.chunks[nextChunkIndex]!.consumedEndSegmentIndex
  ) {
    nextChunkIndex++
  }
  if (nextChunkIndex >= prepared.chunks.length) return -1
  return normalizeLineStartInChunk(prepared, nextChunkIndex, cursor)
}

export function normalizeLineStart(
  prepared: PreparedLineBreakData,
  start: LineBreakCursor,
): LineBreakCursor | null {
  const cursor = {
    segmentIndex: start.segmentIndex,
    graphemeIndex: start.graphemeIndex,
  }
  const chunkIndex = normalizeLineStartChunkIndex(prepared, cursor)
  return chunkIndex < 0 ? null : cursor
}
