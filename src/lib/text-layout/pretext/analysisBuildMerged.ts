import {
  containsArabicScript,
  getLastCodePoint,
  isCJK,
} from './analysisCodePoints'
import { applyPostCompactionMerges } from './analysisPostMerges'
import {
  endsWithClosingQuote,
  endsWithMyanmarMedialGlue,
  getRepeatableSingleCharRunChar,
  hasArabicNoSpacePunctuation,
  isCJKLineStartProhibitedSegment,
  isEscapedQuoteClusterSegment,
  isForwardStickyClusterSegment,
  isLeftStickyPunctuationSegment,
  materializeDeferredSingleCharRun,
  splitLeadingSpaceAndMarks,
} from './analysisPunctuation'
import { getSharedWordSegmenter } from './analysisSegmenter'
import {
  joinReversedPrefixParts,
  joinTextParts,
  splitSegmentByBreakKind,
} from './analysisSegments'
import type {
  AnalysisProfile,
  MergedSegmentation,
  SegmentBreakKind,
  WhiteSpaceProfile,
} from './analysisTypes'

export function buildMergedSegmentation(
  normalized: string,
  profile: AnalysisProfile,
  whiteSpaceProfile: WhiteSpaceProfile,
): MergedSegmentation {
  const wordSegmenter = getSharedWordSegmenter()
  let mergedLen = 0
  const mergedTexts: string[] = []
  const mergedTextParts: string[][] = []
  const mergedWordLike: boolean[] = []
  const mergedKinds: SegmentBreakKind[] = []
  const mergedStarts: number[] = []
  // Track repeatable single-char punctuation runs structurally so identical
  // merges stay O(1) instead of re-scanning the accumulated segment each time.
  const mergedSingleCharRunChars: (string | null)[] = []
  const mergedSingleCharRunLengths: number[] = []
  const mergedContainsCJK: boolean[] = []
  const mergedContainsArabicScript: boolean[] = []
  const mergedEndsWithClosingQuote: boolean[] = []
  const mergedEndsWithMyanmarMedialGlue: boolean[] = []
  const mergedHasArabicNoSpacePunctuation: boolean[] = []

  for (const s of wordSegmenter.segment(normalized)) {
    for (const piece of splitSegmentByBreakKind(s.segment, s.isWordLike ?? false, s.index, whiteSpaceProfile)) {
      const isText = piece.kind === 'text'
      const repeatableSingleCharRunChar = getRepeatableSingleCharRunChar(piece.text, piece.isWordLike, piece.kind)
      const pieceContainsCJK = isCJK(piece.text)
      const pieceContainsArabicScript = containsArabicScript(piece.text)
      const pieceLastCodePoint = getLastCodePoint(piece.text)
      const pieceEndsWithClosingQuote = endsWithClosingQuote(piece.text)
      const pieceEndsWithMyanmarMedialGlue = endsWithMyanmarMedialGlue(piece.text)
      const prevIndex = mergedLen - 1

      function appendPieceToPrevious(): void {
        if (mergedSingleCharRunChars[prevIndex] !== null) {
          mergedTextParts[prevIndex] = [
            materializeDeferredSingleCharRun(
              mergedTexts,
              mergedSingleCharRunChars,
              mergedSingleCharRunLengths,
              prevIndex,
            ),
          ]
          mergedSingleCharRunChars[prevIndex] = null
        }
        mergedTextParts[prevIndex]!.push(piece.text)
        mergedWordLike[prevIndex] = mergedWordLike[prevIndex]! || piece.isWordLike
        mergedContainsCJK[prevIndex] = mergedContainsCJK[prevIndex]! || pieceContainsCJK
        mergedContainsArabicScript[prevIndex] =
          mergedContainsArabicScript[prevIndex]! || pieceContainsArabicScript
        mergedEndsWithClosingQuote[prevIndex] = pieceEndsWithClosingQuote
        mergedEndsWithMyanmarMedialGlue[prevIndex] = pieceEndsWithMyanmarMedialGlue
        mergedHasArabicNoSpacePunctuation[prevIndex] = hasArabicNoSpacePunctuation(
          mergedContainsArabicScript[prevIndex]!,
          pieceLastCodePoint,
        )
      }

      // First-pass keeps: no-space script-specific joins and punctuation glue
      // that depend on the immediately preceding text run.
      if (
        profile.carryCJKAfterClosingQuote &&
        isText &&
        mergedLen > 0 &&
        mergedKinds[prevIndex] === 'text' &&
        pieceContainsCJK &&
        mergedContainsCJK[prevIndex] &&
        mergedEndsWithClosingQuote[prevIndex]!
      ) {
        appendPieceToPrevious()
      } else if (
        isText &&
        mergedLen > 0 &&
        mergedKinds[prevIndex] === 'text' &&
        isCJKLineStartProhibitedSegment(piece.text) &&
        mergedContainsCJK[prevIndex]
      ) {
        appendPieceToPrevious()
      } else if (
        isText &&
        mergedLen > 0 &&
        mergedKinds[prevIndex] === 'text' &&
        mergedEndsWithMyanmarMedialGlue[prevIndex]
      ) {
        appendPieceToPrevious()
      } else if (
        isText &&
        mergedLen > 0 &&
        mergedKinds[prevIndex] === 'text' &&
        piece.isWordLike &&
        pieceContainsArabicScript &&
        mergedHasArabicNoSpacePunctuation[prevIndex]
      ) {
        appendPieceToPrevious()
        mergedWordLike[prevIndex] = true
      } else if (
        repeatableSingleCharRunChar !== null &&
        mergedLen > 0 &&
        mergedKinds[prevIndex] === 'text' &&
        mergedSingleCharRunChars[prevIndex] === repeatableSingleCharRunChar
      ) {
        mergedSingleCharRunLengths[prevIndex] = (mergedSingleCharRunLengths[prevIndex] ?? 1) + 1
      } else if (
        isText &&
        !piece.isWordLike &&
        mergedLen > 0 &&
        mergedKinds[prevIndex] === 'text' &&
        !mergedContainsCJK[prevIndex] &&
        (
          isLeftStickyPunctuationSegment(piece.text) ||
          (piece.text === '-' && mergedWordLike[prevIndex]!)
        )
      ) {
        appendPieceToPrevious()
      } else {
        mergedTexts[mergedLen] = piece.text
        mergedTextParts[mergedLen] = [piece.text]
        mergedWordLike[mergedLen] = piece.isWordLike
        mergedKinds[mergedLen] = piece.kind
        mergedStarts[mergedLen] = piece.start
        mergedSingleCharRunChars[mergedLen] = repeatableSingleCharRunChar
        mergedSingleCharRunLengths[mergedLen] = repeatableSingleCharRunChar === null ? 0 : 1
        mergedContainsCJK[mergedLen] = pieceContainsCJK
        mergedContainsArabicScript[mergedLen] = pieceContainsArabicScript
        mergedEndsWithClosingQuote[mergedLen] = pieceEndsWithClosingQuote
        mergedEndsWithMyanmarMedialGlue[mergedLen] = pieceEndsWithMyanmarMedialGlue
        mergedHasArabicNoSpacePunctuation[mergedLen] = hasArabicNoSpacePunctuation(
          pieceContainsArabicScript,
          pieceLastCodePoint,
        )
        mergedLen++
      }
    }
  }

  for (let i = 0; i < mergedLen; i++) {
    if (mergedSingleCharRunChars[i] !== null) {
      mergedTexts[i] = materializeDeferredSingleCharRun(
        mergedTexts,
        mergedSingleCharRunChars,
        mergedSingleCharRunLengths,
        i,
      )
      continue
    }
    mergedTexts[i] = joinTextParts(mergedTextParts[i]!)
  }

  // Later passes operate on the merged text stream itself: contextual escaped
  // quote glue, forward-sticky carry, compaction, then the broader URL/numeric
  // and Arabic-leading-mark fixes.
  for (let i = 1; i < mergedLen; i++) {
    if (
      mergedKinds[i] === 'text' &&
      !mergedWordLike[i]! &&
      isEscapedQuoteClusterSegment(mergedTexts[i]!) &&
      mergedKinds[i - 1] === 'text' &&
      !mergedContainsCJK[i - 1]
    ) {
      mergedTexts[i - 1] += mergedTexts[i]!
      mergedWordLike[i - 1] = mergedWordLike[i - 1]! || mergedWordLike[i]!
      mergedTexts[i] = ''
    }
  }

  const forwardStickyPrefixParts: (string[] | null)[] = Array.from({ length: mergedLen }, () => null)
  let nextLiveIndex = -1

  for (let i = mergedLen - 1; i >= 0; i--) {
    const text = mergedTexts[i]!
    if (text.length === 0) continue

    if (
      mergedKinds[i] === 'text' &&
      !mergedWordLike[i]! &&
      isForwardStickyClusterSegment(text) &&
      nextLiveIndex >= 0 &&
      mergedKinds[nextLiveIndex] === 'text'
    ) {
      const prefixParts = forwardStickyPrefixParts[nextLiveIndex] ?? []
      prefixParts.push(text)
      forwardStickyPrefixParts[nextLiveIndex] = prefixParts
      mergedStarts[nextLiveIndex] = mergedStarts[i]!
      mergedTexts[i] = ''
      continue
    }

    nextLiveIndex = i
  }

  for (let i = 0; i < mergedLen; i++) {
    const prefixParts = forwardStickyPrefixParts[i]
    if (prefixParts == null) continue
    mergedTexts[i] = joinReversedPrefixParts(prefixParts, mergedTexts[i]!)
  }

  let compactLen = 0
  for (let read = 0; read < mergedLen; read++) {
    const text = mergedTexts[read]!
    if (text.length === 0) continue
    if (compactLen !== read) {
      mergedTexts[compactLen] = text
      mergedWordLike[compactLen] = mergedWordLike[read]!
      mergedKinds[compactLen] = mergedKinds[read]!
      mergedStarts[compactLen] = mergedStarts[read]!
    }
    compactLen++
  }

  mergedTexts.length = compactLen
  mergedWordLike.length = compactLen
  mergedKinds.length = compactLen
  mergedStarts.length = compactLen

  const withMergedUrls = applyPostCompactionMerges({
    len: compactLen,
    texts: mergedTexts,
    isWordLike: mergedWordLike,
    kinds: mergedKinds,
    starts: mergedStarts,
  })

  for (let i = 0; i < withMergedUrls.len - 1; i++) {
    const split = splitLeadingSpaceAndMarks(withMergedUrls.texts[i]!)
    if (split === null) continue
    if (
      (withMergedUrls.kinds[i] !== 'space' && withMergedUrls.kinds[i] !== 'preserved-space') ||
      withMergedUrls.kinds[i + 1] !== 'text' ||
      !containsArabicScript(withMergedUrls.texts[i + 1]!)
    ) {
      continue
    }

    withMergedUrls.texts[i] = split.space
    withMergedUrls.isWordLike[i] = false
    withMergedUrls.kinds[i] = withMergedUrls.kinds[i] === 'preserved-space' ? 'preserved-space' : 'space'
    withMergedUrls.texts[i + 1] = split.marks + withMergedUrls.texts[i + 1]!
    withMergedUrls.starts[i + 1] = withMergedUrls.starts[i]! + split.space.length
  }

  return withMergedUrls
}
