import { buildMergedSegmentation } from './analysisBuildMerged'
import { compileAnalysisChunks } from './analysisChunks'
import { mergeKeepAllTextSegments } from './analysisKeepAll'
import {
  clearAnalysisCaches,
  setAnalysisLocale,
} from './analysisSegmenter'
import {
  getWhiteSpaceProfile,
  normalizeWhitespaceNormal,
  normalizeWhitespacePreWrap,
} from './analysisWhitespace'
import type {
  AnalysisProfile,
  TextAnalysis,
  WhiteSpaceMode,
  WordBreakMode,
} from './analysisTypes'

export type {
  AnalysisChunk,
  AnalysisProfile,
  MergedSegmentation,
  SegmentBreakKind,
  TextAnalysis,
  WhiteSpaceMode,
  WordBreakMode,
} from './analysisTypes'
export { isCJK } from './analysisCodePoints'
export { isNumericRunSegment } from './analysisNumericMerges'
export {
  canContinueKeepAllTextRun,
  endsWithClosingQuote,
  kinsokuEnd,
  kinsokuStart,
  leftStickyPunctuation,
} from './analysisPunctuation'
export {
  clearAnalysisCaches,
  normalizeWhitespaceNormal,
  setAnalysisLocale,
}

export function analyzeText(
  text: string,
  profile: AnalysisProfile,
  whiteSpace: WhiteSpaceMode = 'normal',
  wordBreak: WordBreakMode = 'normal',
): TextAnalysis {
  const whiteSpaceProfile = getWhiteSpaceProfile(whiteSpace)
  const normalized = whiteSpaceProfile.mode === 'pre-wrap'
    ? normalizeWhitespacePreWrap(text)
    : normalizeWhitespaceNormal(text)
  if (normalized.length === 0) {
    return {
      normalized,
      chunks: [],
      len: 0,
      texts: [],
      isWordLike: [],
      kinds: [],
      starts: [],
    }
  }
  const mergedSegmentation = buildMergedSegmentation(normalized, profile, whiteSpaceProfile)
  const segmentation = wordBreak === 'keep-all'
    ? mergeKeepAllTextSegments(normalized, mergedSegmentation, profile.breakKeepAllAfterPunctuation)
    : mergedSegmentation
  return {
    normalized,
    chunks: compileAnalysisChunks(segmentation, whiteSpaceProfile),
    ...segmentation,
  }
}
