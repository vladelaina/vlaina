import {
  normalizeLineStartChunkIndex,
  normalizeLineStartChunkIndexFromHint,
} from './lineBreakHelpers'
import { walkPreparedLinesRaw } from './lineBreakRawWalk'
import { stepPreparedChunkLineGeometry } from './lineBreakStepChunk'
import { stepPreparedSimpleLineGeometry } from './lineBreakStepSimple'
import type { InternalLayoutLine, LineBreakCursor, PreparedLineBreakData } from './lineBreakTypes'

export function walkPreparedLines(
  prepared: PreparedLineBreakData,
  maxWidth: number,
  onLine?: (line: InternalLayoutLine) => void,
): number {
  if (onLine === undefined) return walkPreparedLinesRaw(prepared, maxWidth)

  return walkPreparedLinesRaw(
    prepared,
    maxWidth,
    (width, startSegmentIndex, startGraphemeIndex, endSegmentIndex, endGraphemeIndex) => {
      onLine({
        startSegmentIndex,
        startGraphemeIndex,
        endSegmentIndex,
        endGraphemeIndex,
        width,
      })
    },
  )
}

export function layoutNextLineRange(
  prepared: PreparedLineBreakData,
  start: LineBreakCursor,
  maxWidth: number,
): InternalLayoutLine | null {
  const end: LineBreakCursor = {
    segmentIndex: start.segmentIndex,
    graphemeIndex: start.graphemeIndex,
  }
  const chunkIndex = normalizeLineStartChunkIndex(prepared, end)
  if (chunkIndex < 0) return null

  const lineStartSegmentIndex = end.segmentIndex
  const lineStartGraphemeIndex = end.graphemeIndex
  const width = prepared.simpleLineWalkFastPath
    ? stepPreparedSimpleLineGeometry(prepared, end, maxWidth)
    : stepPreparedChunkLineGeometry(prepared, end, chunkIndex, maxWidth)
  if (width === null) return null

  return {
    startSegmentIndex: lineStartSegmentIndex,
    startGraphemeIndex: lineStartGraphemeIndex,
    endSegmentIndex: end.segmentIndex,
    endGraphemeIndex: end.graphemeIndex,
    width,
  }
}

export function stepPreparedLineGeometry(
  prepared: PreparedLineBreakData,
  cursor: LineBreakCursor,
  maxWidth: number,
): number | null {
  const chunkIndex = normalizeLineStartChunkIndex(prepared, cursor)
  if (chunkIndex < 0) return null

  if (prepared.simpleLineWalkFastPath) {
    return stepPreparedSimpleLineGeometry(prepared, cursor, maxWidth)
  }

  return stepPreparedChunkLineGeometry(prepared, cursor, chunkIndex, maxWidth)
}

export function measurePreparedLineGeometry(
  prepared: PreparedLineBreakData,
  maxWidth: number,
): {
  lineCount: number
  maxLineWidth: number
} {
  if (prepared.widths.length === 0) {
    return {
      lineCount: 0,
      maxLineWidth: 0,
    }
  }

  const cursor: LineBreakCursor = {
    segmentIndex: 0,
    graphemeIndex: 0,
  }
  let lineCount = 0
  let maxLineWidth = 0

  if (!prepared.simpleLineWalkFastPath) {
    let chunkIndex = normalizeLineStartChunkIndex(prepared, cursor)
    while (chunkIndex >= 0) {
      const lineWidth = stepPreparedChunkLineGeometry(prepared, cursor, chunkIndex, maxWidth)
      if (lineWidth === null) {
        return {
          lineCount,
          maxLineWidth,
        }
      }
      lineCount++
      if (lineWidth > maxLineWidth) maxLineWidth = lineWidth
      chunkIndex = normalizeLineStartChunkIndexFromHint(prepared, chunkIndex, cursor)
    }
    return {
      lineCount,
      maxLineWidth,
    }
  }

  while (true) {
    const lineWidth = stepPreparedLineGeometry(prepared, cursor, maxWidth)
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
