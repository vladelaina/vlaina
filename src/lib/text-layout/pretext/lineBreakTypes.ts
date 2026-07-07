import type { SegmentBreakKind } from './analysis.js'

export type LineBreakCursor = {
  segmentIndex: number
  graphemeIndex: number
}

export type PreparedLineBreakData = {
  widths: number[]
  lineEndFitAdvances: number[]
  lineEndPaintAdvances: number[]
  kinds: SegmentBreakKind[]
  simpleLineWalkFastPath: boolean
  breakableFitAdvances: (number[] | null)[]
  letterSpacing: number
  spacingGraphemeCounts: number[]
  discretionaryHyphenWidth: number
  tabStopAdvance: number
  chunks: {
    startSegmentIndex: number
    endSegmentIndex: number
    consumedEndSegmentIndex: number
  }[]
}

export type InternalLayoutLine = {
  startSegmentIndex: number
  startGraphemeIndex: number
  endSegmentIndex: number
  endGraphemeIndex: number
  width: number
}

export type InternalLineVisitor = (
  width: number,
  startSegmentIndex: number,
  startGraphemeIndex: number,
  endSegmentIndex: number,
  endGraphemeIndex: number,
) => void
