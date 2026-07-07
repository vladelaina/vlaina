import { computeSegmentLevels } from './bidi.js'
import {
  analyzeText,
  isCJK,
  isNumericRunSegment,
  type SegmentBreakKind,
  type TextAnalysis,
} from './analysis.js'
import {
  type BreakableFitMode,
  getCorrectedSegmentWidth,
  getSegmentBreakableFitAdvances,
  getEngineProfile,
  getFontMeasurementState,
  getSegmentMetrics,
  textMayContainEmoji,
} from './measurement.js'
import {
  addInternalLetterSpacing,
  buildBaseCjkUnits,
  countRenderedSpacingGraphemes,
  mergeKeepAllTextUnits,
} from './layoutGraphemeUnits.js'
import type {
  InternalPreparedText,
  PrepareOptions,
  PreparedText,
  PreparedTextWithSegments,
  WordBreakMode,
} from './layoutTypes.js'
import { createEmptyPrepared, mapAnalysisChunksToPreparedChunks } from './layoutPrepareHelpers.js'

function measureAnalysis(
  analysis: TextAnalysis,
  font: string,
  includeSegments: boolean,
  wordBreak: WordBreakMode,
  letterSpacing: number,
): InternalPreparedText | PreparedTextWithSegments {
  const engineProfile = getEngineProfile()
  const { cache, emojiCorrection } = getFontMeasurementState(
    font,
    textMayContainEmoji(analysis.normalized),
  )
  const discretionaryHyphenWidth =
    getCorrectedSegmentWidth('-', getSegmentMetrics('-', cache), emojiCorrection) +
    (letterSpacing === 0 ? 0 : letterSpacing)
  const spaceWidth = getCorrectedSegmentWidth(' ', getSegmentMetrics(' ', cache), emojiCorrection)
  const tabStopAdvance = spaceWidth * 8
  const hasLetterSpacing = letterSpacing !== 0

  if (analysis.len === 0) return createEmptyPrepared(includeSegments)

  const widths: number[] = []
  const lineEndFitAdvances: number[] = []
  const lineEndPaintAdvances: number[] = []
  const kinds: SegmentBreakKind[] = []
  let simpleLineWalkFastPath = analysis.chunks.length <= 1 && !hasLetterSpacing
  const segStarts = includeSegments ? [] as number[] : null
  const breakableFitAdvances: (number[] | null)[] = []
  const spacingGraphemeCounts: number[] = []
  const segments = includeSegments ? [] as string[] : null
  const preparedStartByAnalysisIndex = Array.from<number>({ length: analysis.len })

  function pushMeasuredSegment(
    text: string,
    width: number,
    lineEndFitAdvance: number,
    lineEndPaintAdvance: number,
    kind: SegmentBreakKind,
    start: number,
    breakableFitAdvance: number[] | null,
    spacingGraphemeCount: number,
  ): void {
    if (kind !== 'text' && kind !== 'space' && kind !== 'zero-width-break') {
      simpleLineWalkFastPath = false
    }
    widths.push(width)
    lineEndFitAdvances.push(lineEndFitAdvance)
    lineEndPaintAdvances.push(lineEndPaintAdvance)
    kinds.push(kind)
    segStarts?.push(start)
    breakableFitAdvances.push(breakableFitAdvance)
    if (hasLetterSpacing) spacingGraphemeCounts.push(spacingGraphemeCount)
    if (segments !== null) segments.push(text)
  }

  function pushMeasuredTextSegment(
    text: string,
    kind: SegmentBreakKind,
    start: number,
    wordLike: boolean,
    allowOverflowBreaks: boolean,
  ): void {
    const textMetrics = getSegmentMetrics(text, cache)
    const spacingGraphemeCount = hasLetterSpacing
      ? countRenderedSpacingGraphemes(text, kind)
      : 0
    const width = addInternalLetterSpacing(
      getCorrectedSegmentWidth(text, textMetrics, emojiCorrection),
      spacingGraphemeCount,
      letterSpacing,
    )
    const baseLineEndFitAdvance =
      kind === 'space' || kind === 'preserved-space' || kind === 'zero-width-break'
        ? 0
        : width
    const lineEndFitAdvance =
      baseLineEndFitAdvance === 0
        ? 0
        : baseLineEndFitAdvance + (spacingGraphemeCount > 0 ? letterSpacing : 0)
    const lineEndPaintAdvance =
      kind === 'space' || kind === 'zero-width-break'
        ? 0
        : width

    if (allowOverflowBreaks && wordLike && text.length > 1) {
      let fitMode: BreakableFitMode = 'sum-graphemes'
      if (letterSpacing !== 0) {
        fitMode = 'segment-prefixes'
      } else if (isNumericRunSegment(text)) {
        fitMode = 'pair-context'
      } else if (engineProfile.preferPrefixWidthsForBreakableRuns) {
        fitMode = 'segment-prefixes'
      }
      const fitAdvances = getSegmentBreakableFitAdvances(
        text,
        textMetrics,
        cache,
        emojiCorrection,
        fitMode,
      )
      pushMeasuredSegment(
        text,
        width,
        lineEndFitAdvance,
        lineEndPaintAdvance,
        kind,
        start,
        fitAdvances,
        spacingGraphemeCount,
      )
      return
    }

    pushMeasuredSegment(
      text,
      width,
      lineEndFitAdvance,
      lineEndPaintAdvance,
      kind,
      start,
      null,
      spacingGraphemeCount,
    )
  }

  for (let mi = 0; mi < analysis.len; mi++) {
    preparedStartByAnalysisIndex[mi] = widths.length
    const segText = analysis.texts[mi]!
    const segWordLike = analysis.isWordLike[mi]!
    const segKind = analysis.kinds[mi]!
    const segStart = analysis.starts[mi]!

    if (segKind === 'soft-hyphen') {
      pushMeasuredSegment(
        segText,
        0,
        discretionaryHyphenWidth,
        discretionaryHyphenWidth,
        segKind,
        segStart,
        null,
        0,
      )
      continue
    }

    if (segKind === 'hard-break') {
      pushMeasuredSegment(segText, 0, 0, 0, segKind, segStart, null, 0)
      continue
    }

    if (segKind === 'tab') {
      pushMeasuredSegment(
        segText,
        0,
        0,
        0,
        segKind,
        segStart,
        null,
        hasLetterSpacing ? countRenderedSpacingGraphemes(segText, segKind) : 0,
      )
      continue
    }

    const segMetrics = getSegmentMetrics(segText, cache)

    if (segKind === 'text' && segMetrics.containsCJK) {
      const baseUnits = buildBaseCjkUnits(segText, engineProfile)
      const measuredUnits = wordBreak === 'keep-all'
        ? mergeKeepAllTextUnits(segText, baseUnits, engineProfile.breakKeepAllAfterPunctuation)
        : baseUnits

      for (let i = 0; i < measuredUnits.length; i++) {
        const unit = measuredUnits[i]!
        pushMeasuredTextSegment(
          unit.text,
          'text',
          segStart + unit.start,
          segWordLike,
          wordBreak === 'keep-all' || !isCJK(unit.text),
        )
      }
      continue
    }

    pushMeasuredTextSegment(segText, segKind, segStart, segWordLike, true)
  }

  const chunks = mapAnalysisChunksToPreparedChunks(analysis.chunks, preparedStartByAnalysisIndex, widths.length)
  const segLevels = segStarts === null ? null : computeSegmentLevels(analysis.normalized, segStarts)
  const shared = {
    widths,
    lineEndFitAdvances,
    lineEndPaintAdvances,
    kinds,
    simpleLineWalkFastPath,
    segLevels,
    breakableFitAdvances,
    letterSpacing,
    spacingGraphemeCounts,
    discretionaryHyphenWidth,
    tabStopAdvance,
    chunks,
  }
  return segments !== null
    ? { ...shared, segments } as unknown as PreparedTextWithSegments
    : shared as unknown as InternalPreparedText
}

function prepareInternal(
  text: string,
  font: string,
  includeSegments: boolean,
  options?: PrepareOptions,
): InternalPreparedText | PreparedTextWithSegments {
  const wordBreak = options?.wordBreak ?? 'normal'
  const letterSpacing = options?.letterSpacing ?? 0
  const analysis = analyzeText(text, getEngineProfile(), options?.whiteSpace, wordBreak)
  return measureAnalysis(analysis, font, includeSegments, wordBreak, letterSpacing)
}

export function prepare(text: string, font: string, options?: PrepareOptions): PreparedText {
  return prepareInternal(text, font, false, options) as PreparedText
}

export function prepareWithSegments(text: string, font: string, options?: PrepareOptions): PreparedTextWithSegments {
  return prepareInternal(text, font, true, options) as PreparedTextWithSegments
}
