export type WhiteSpaceMode = 'normal' | 'pre-wrap'
export type WordBreakMode = 'normal' | 'keep-all'

export type SegmentBreakKind =
  | 'text'
  | 'space'
  | 'preserved-space'
  | 'tab'
  | 'glue'
  | 'zero-width-break'
  | 'soft-hyphen'
  | 'hard-break'

export type SegmentationPiece = {
  text: string
  isWordLike: boolean
  kind: SegmentBreakKind
  start: number
}

export type MergedSegmentation = {
  len: number
  texts: string[]
  isWordLike: boolean[]
  kinds: SegmentBreakKind[]
  starts: number[]
}

export type AnalysisChunk = {
  startSegmentIndex: number
  endSegmentIndex: number
  consumedEndSegmentIndex: number
}

export type TextAnalysis = { normalized: string, chunks: AnalysisChunk[] } & MergedSegmentation

export type AnalysisProfile = {
  carryCJKAfterClosingQuote: boolean
  breakKeepAllAfterPunctuation: boolean
}

export type WhiteSpaceProfile = {
  mode: WhiteSpaceMode
  preserveOrdinarySpaces: boolean
  preserveHardBreaks: boolean
}
