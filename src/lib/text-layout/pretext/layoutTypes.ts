import type { SegmentBreakKind, WhiteSpaceMode, WordBreakMode as AnalysisWordBreakMode } from './analysis.js'

declare const preparedTextBrand: unique symbol

export type PreparedLineChunk = {
  startSegmentIndex: number
  endSegmentIndex: number
  consumedEndSegmentIndex: number
}

export type PreparedCore = {
  widths: number[]
  lineEndFitAdvances: number[]
  lineEndPaintAdvances: number[]
  kinds: SegmentBreakKind[]
  simpleLineWalkFastPath: boolean
  segLevels: Int8Array | null
  breakableFitAdvances: (number[] | null)[]
  letterSpacing: number
  spacingGraphemeCounts: number[]
  discretionaryHyphenWidth: number
  tabStopAdvance: number
  chunks: PreparedLineChunk[]
}

export type PreparedText = {
  readonly [preparedTextBrand]: true
}

export type InternalPreparedText = PreparedText & PreparedCore

export type PreparedTextWithSegments = InternalPreparedText & {
  segments: string[]
}

export type LayoutCursor = {
  segmentIndex: number
  graphemeIndex: number
}

export type LayoutResult = {
  lineCount: number
  height: number
}

export type LineStats = {
  lineCount: number
  maxLineWidth: number
}

export type LayoutLine = {
  text: string
  width: number
  start: LayoutCursor
  end: LayoutCursor
}

export type LayoutLineRange = {
  width: number
  start: LayoutCursor
  end: LayoutCursor
}

export type LayoutLinesResult = LayoutResult & {
  lines: LayoutLine[]
}

export type WordBreakMode = AnalysisWordBreakMode

export type PrepareOptions = {
  whiteSpace?: WhiteSpaceMode
  wordBreak?: WordBreakMode
  letterSpacing?: number
}

export type MeasuredTextUnit = {
  text: string
  start: number
}
