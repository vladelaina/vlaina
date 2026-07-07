import { combiningMarkRe, getLastCodePoint, previousCodePointStart } from './analysisCodePoints'
import type { SegmentBreakKind } from './analysisTypes'

export const kinsokuStart = new Set([
  '\uFF0C',
  '\uFF0E',
  '\uFF01',
  '\uFF1A',
  '\uFF1B',
  '\uFF1F',
  '\u3001',
  '\u3002',
  '\u30FB',
  '\uFF09',
  '\u3015',
  '\u3009',
  '\u300B',
  '\u300D',
  '\u300F',
  '\u3011',
  '\u3017',
  '\u3019',
  '\u301B',
  '\u30FC',
  '\u3005',
  '\u303B',
  '\u309D',
  '\u309E',
  '\u30FD',
  '\u30FE',
])

export const kinsokuEnd = new Set([
  '"',
  '(', '[', '{',
  '“', '‘', '«', '‹',
  '\uFF08',
  '\u3014',
  '\u3008',
  '\u300A',
  '\u300C',
  '\u300E',
  '\u3010',
  '\u3016',
  '\u3018',
  '\u301A',
])

const forwardStickyGlue = new Set([
  "'", '’',
])

export const leftStickyPunctuation = new Set([
  '.', ',', '!', '?', ':', ';',
  '\u060C',
  '\u061B',
  '\u061F',
  '\u0964',
  '\u0965',
  '\u104A',
  '\u104B',
  '\u104C',
  '\u104D',
  '\u104F',
  ')', ']', '}',
  '%',
  '"',
  '”', '’', '»', '›',
  '…',
])

const keepAllGlueChars = new Set([
  '\u00A0',
  '\u202F',
  '\u2060',
  '\uFEFF',
])

const keepAllDashBreakChars = new Set([
  '-',
  '\u2010',
  '\u2013',
  '\u2014',
])

const arabicNoSpaceTrailingPunctuation = new Set([
  ':',
  '.',
  '\u060C',
  '\u061B',
])

const myanmarMedialGlue = new Set([
  '\u104F',
])

const closingQuoteChars = new Set([
  '”', '’', '»', '›',
  '\u300D',
  '\u300F',
  '\u3011',
  '\u300B',
  '\u3009',
  '\u3015',
  '\uFF09',
])

function endsWithLineStartProhibitedText(text: string): boolean {
  const last = getLastCodePoint(text)
  return last !== null && (kinsokuStart.has(last) || leftStickyPunctuation.has(last))
}

function endsWithKeepAllGlueText(text: string): boolean {
  const last = getLastCodePoint(text)
  return last !== null && keepAllGlueChars.has(last)
}

function endsWithKeepAllDashBreakText(text: string): boolean {
  const last = getLastCodePoint(text)
  return last !== null && keepAllDashBreakChars.has(last)
}

export function canContinueKeepAllTextRun(previousText: string, breakAfterPunctuation: boolean): boolean {
  if (endsWithKeepAllGlueText(previousText)) return false
  if (!breakAfterPunctuation) return true
  if (endsWithLineStartProhibitedText(previousText)) return false
  if (endsWithKeepAllDashBreakText(previousText)) return false
  return true
}

export function isLeftStickyPunctuationSegment(segment: string): boolean {
  if (isEscapedQuoteClusterSegment(segment)) return true
  let sawPunctuation = false
  for (const ch of segment) {
    if (leftStickyPunctuation.has(ch)) {
      sawPunctuation = true
      continue
    }
    if (sawPunctuation && combiningMarkRe.test(ch)) continue
    return false
  }
  return sawPunctuation
}

export function isCJKLineStartProhibitedSegment(segment: string): boolean {
  for (const ch of segment) {
    if (!kinsokuStart.has(ch) && !leftStickyPunctuation.has(ch)) return false
  }
  return segment.length > 0
}

export function isForwardStickyClusterSegment(segment: string): boolean {
  if (isEscapedQuoteClusterSegment(segment)) return true
  for (const ch of segment) {
    if (!kinsokuEnd.has(ch) && !forwardStickyGlue.has(ch) && !combiningMarkRe.test(ch)) return false
  }
  return segment.length > 0
}

export function isEscapedQuoteClusterSegment(segment: string): boolean {
  let sawQuote = false
  for (const ch of segment) {
    if (ch === '\\' || combiningMarkRe.test(ch)) continue
    if (kinsokuEnd.has(ch) || leftStickyPunctuation.has(ch) || forwardStickyGlue.has(ch)) {
      sawQuote = true
      continue
    }
    return false
  }
  return sawQuote
}

export function splitTrailingForwardStickyCluster(text: string): { head: string, tail: string } | null {
  let splitIndex = text.length

  while (splitIndex > 0) {
    const chStart = previousCodePointStart(text, splitIndex)
    const ch = text.slice(chStart, splitIndex)
    if (combiningMarkRe.test(ch)) {
      splitIndex = chStart
      continue
    }
    if (kinsokuEnd.has(ch) || forwardStickyGlue.has(ch)) {
      splitIndex = chStart
      continue
    }
    break
  }

  if (splitIndex <= 0 || splitIndex === text.length) return null
  return {
    head: text.slice(0, splitIndex),
    tail: text.slice(splitIndex),
  }
}

export function getRepeatableSingleCharRunChar(
  text: string,
  isWordLike: boolean,
  kind: SegmentBreakKind,
): string | null {
  return kind === 'text' && !isWordLike && text.length === 1 && text !== '-' && text !== '—'
    ? text
    : null
}

export function materializeDeferredSingleCharRun(
  texts: string[],
  chars: (string | null)[],
  lengths: number[],
  index: number,
): string {
  const ch = chars[index]
  const text = texts[index]!
  if (ch == null) return text

  const length = lengths[index]!
  if (text.length === length) return text

  const materialized = ch.repeat(length)
  texts[index] = materialized
  return materialized
}

export function hasArabicNoSpacePunctuation(
  containsArabic: boolean,
  lastCodePoint: string | null,
): boolean {
  return containsArabic && lastCodePoint !== null && arabicNoSpaceTrailingPunctuation.has(lastCodePoint)
}

export function endsWithMyanmarMedialGlue(segment: string): boolean {
  const lastCodePoint = getLastCodePoint(segment)
  return lastCodePoint !== null && myanmarMedialGlue.has(lastCodePoint)
}

export function splitLeadingSpaceAndMarks(segment: string): { space: string, marks: string } | null {
  if (segment.length < 2 || segment[0] !== ' ') return null
  const marks = segment.slice(1)
  if (/^\p{M}+$/u.test(marks)) {
    return { space: ' ', marks }
  }
  return null
}

export function endsWithClosingQuote(text: string): boolean {
  let end = text.length
  while (end > 0) {
    const start = previousCodePointStart(text, end)
    const ch = text.slice(start, end)
    if (closingQuoteChars.has(ch)) return true
    if (!leftStickyPunctuation.has(ch)) return false
    end = start
  }
  return false
}
