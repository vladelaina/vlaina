import {
  countPreparedLines,
  measurePreparedLineGeometry,
  normalizeLineStart,
  stepPreparedLineGeometry,
  walkPreparedLinesRaw,
} from './line-break.js'
import {
  buildLineTextFromRange,
  getLineTextCache,
} from './line-text.js'
import type {
  InternalPreparedText,
  LayoutCursor,
  LayoutLine,
  LayoutLineRange,
  LayoutLinesResult,
  LayoutResult,
  LineStats,
  PreparedText,
  PreparedTextWithSegments,
} from './layoutTypes.js'

function getInternalPrepared(prepared: PreparedText): InternalPreparedText {
  return prepared as InternalPreparedText
}

export function layout(prepared: PreparedText, maxWidth: number, lineHeight: number): LayoutResult {
  const lineCount = countPreparedLines(getInternalPrepared(prepared), maxWidth)
  return { lineCount, height: lineCount * lineHeight }
}

function createLayoutLine(
  prepared: PreparedTextWithSegments,
  cache: Map<number, string[]>,
  width: number,
  startSegmentIndex: number,
  startGraphemeIndex: number,
  endSegmentIndex: number,
  endGraphemeIndex: number,
): LayoutLine {
  return {
    text: buildLineTextFromRange(
      prepared,
      cache,
      startSegmentIndex,
      startGraphemeIndex,
      endSegmentIndex,
      endGraphemeIndex,
    ),
    width,
    start: {
      segmentIndex: startSegmentIndex,
      graphemeIndex: startGraphemeIndex,
    },
    end: {
      segmentIndex: endSegmentIndex,
      graphemeIndex: endGraphemeIndex,
    },
  }
}

function createLayoutLineRange(
  width: number,
  startSegmentIndex: number,
  startGraphemeIndex: number,
  endSegmentIndex: number,
  endGraphemeIndex: number,
): LayoutLineRange {
  return {
    width,
    start: {
      segmentIndex: startSegmentIndex,
      graphemeIndex: startGraphemeIndex,
    },
    end: {
      segmentIndex: endSegmentIndex,
      graphemeIndex: endGraphemeIndex,
    },
  }
}

export function materializeLineRange(
  prepared: PreparedTextWithSegments,
  line: LayoutLineRange,
): LayoutLine {
  return createLayoutLine(
    prepared,
    getLineTextCache(prepared),
    line.width,
    line.start.segmentIndex,
    line.start.graphemeIndex,
    line.end.segmentIndex,
    line.end.graphemeIndex,
  )
}

export function walkLineRanges(
  prepared: PreparedTextWithSegments,
  maxWidth: number,
  onLine: (line: LayoutLineRange) => void,
): number {
  if (prepared.widths.length === 0) return 0

  return walkPreparedLinesRaw(
    getInternalPrepared(prepared),
    maxWidth,
    (width, startSegmentIndex, startGraphemeIndex, endSegmentIndex, endGraphemeIndex) => {
      onLine(createLayoutLineRange(
        width,
        startSegmentIndex,
        startGraphemeIndex,
        endSegmentIndex,
        endGraphemeIndex,
      ))
    },
  )
}

export function measureLineStats(
  prepared: PreparedTextWithSegments,
  maxWidth: number,
): LineStats {
  return measurePreparedLineGeometry(getInternalPrepared(prepared), maxWidth)
}

export function measureNaturalWidth(prepared: PreparedTextWithSegments): number {
  let maxWidth = 0
  walkPreparedLinesRaw(getInternalPrepared(prepared), Number.POSITIVE_INFINITY, width => {
    if (width > maxWidth) maxWidth = width
  })
  return maxWidth
}

export function layoutNextLine(
  prepared: PreparedTextWithSegments,
  start: LayoutCursor,
  maxWidth: number,
): LayoutLine | null {
  const internal = getInternalPrepared(prepared)
  const normalizedStart = normalizeLineStart(internal, start)
  if (normalizedStart === null) return null

  const end = {
    segmentIndex: normalizedStart.segmentIndex,
    graphemeIndex: normalizedStart.graphemeIndex,
  }
  const width = stepPreparedLineGeometry(internal, end, maxWidth)
  if (width === null) return null

  return createLayoutLine(
    prepared,
    getLineTextCache(prepared),
    width,
    normalizedStart.segmentIndex,
    normalizedStart.graphemeIndex,
    end.segmentIndex,
    end.graphemeIndex,
  )
}

export function layoutNextLineRange(
  prepared: PreparedTextWithSegments,
  start: LayoutCursor,
  maxWidth: number,
): LayoutLineRange | null {
  const internal = getInternalPrepared(prepared)
  const normalizedStart = normalizeLineStart(internal, start)
  if (normalizedStart === null) return null

  const end = {
    segmentIndex: normalizedStart.segmentIndex,
    graphemeIndex: normalizedStart.graphemeIndex,
  }
  const width = stepPreparedLineGeometry(internal, end, maxWidth)
  if (width === null) return null

  return createLayoutLineRange(
    width,
    normalizedStart.segmentIndex,
    normalizedStart.graphemeIndex,
    end.segmentIndex,
    end.graphemeIndex,
  )
}

export function layoutWithLines(prepared: PreparedTextWithSegments, maxWidth: number, lineHeight: number): LayoutLinesResult {
  const lines: LayoutLine[] = []
  if (prepared.widths.length === 0) return { lineCount: 0, height: 0, lines }

  const graphemeCache = getLineTextCache(prepared)
  const lineCount = walkPreparedLinesRaw(
    getInternalPrepared(prepared),
    maxWidth,
    (width, startSegmentIndex, startGraphemeIndex, endSegmentIndex, endGraphemeIndex) => {
      lines.push(createLayoutLine(
        prepared,
        graphemeCache,
        width,
        startSegmentIndex,
        startGraphemeIndex,
        endSegmentIndex,
        endGraphemeIndex,
      ))
    },
  )

  return { lineCount, height: lineCount * lineHeight, lines }
}
