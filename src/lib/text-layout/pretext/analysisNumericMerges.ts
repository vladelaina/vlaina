import { decimalDigitRe } from './analysisCodePoints'
import { joinTextParts } from './analysisSegments'
import type { MergedSegmentation, SegmentBreakKind } from './analysisTypes'

const numericJoinerChars = new Set([
  ':', '-', '/', '×', ',', '.', '+',
  '\u2013',
  '\u2014',
])

const asciiPunctuationChainSegmentRe = /^[A-Za-z0-9_]+[.,:;]*$/
const asciiPunctuationChainTrailingJoinersRe = /[.,:;]+$/

function segmentContainsDecimalDigit(text: string): boolean {
  for (const ch of text) {
    if (decimalDigitRe.test(ch)) return true
  }
  return false
}

export function isNumericRunSegment(text: string): boolean {
  if (text.length === 0) return false
  for (const ch of text) {
    if (decimalDigitRe.test(ch) || numericJoinerChars.has(ch)) continue
    return false
  }
  return true
}

export function mergeNumericRuns(segmentation: MergedSegmentation): MergedSegmentation {
  const texts: string[] = []
  const isWordLike: boolean[] = []
  const kinds: SegmentBreakKind[] = []
  const starts: number[] = []

  for (let i = 0; i < segmentation.len; i++) {
    const text = segmentation.texts[i]!
    const kind = segmentation.kinds[i]!

    if (kind === 'text' && isNumericRunSegment(text) && segmentContainsDecimalDigit(text)) {
      const mergedParts = [text]
      let j = i + 1
      while (
        j < segmentation.len &&
        segmentation.kinds[j] === 'text' &&
        isNumericRunSegment(segmentation.texts[j]!)
      ) {
        mergedParts.push(segmentation.texts[j]!)
        j++
      }

      texts.push(joinTextParts(mergedParts))
      isWordLike.push(true)
      kinds.push('text')
      starts.push(segmentation.starts[i]!)
      i = j - 1
      continue
    }

    texts.push(text)
    isWordLike.push(segmentation.isWordLike[i]!)
    kinds.push(kind)
    starts.push(segmentation.starts[i]!)
  }

  return {
    len: texts.length,
    texts,
    isWordLike,
    kinds,
    starts,
  }
}

export function mergeAsciiPunctuationChains(segmentation: MergedSegmentation): MergedSegmentation {
  const texts: string[] = []
  const isWordLike: boolean[] = []
  const kinds: SegmentBreakKind[] = []
  const starts: number[] = []

  for (let i = 0; i < segmentation.len; i++) {
    const text = segmentation.texts[i]!
    const kind = segmentation.kinds[i]!
    const wordLike = segmentation.isWordLike[i]!

    if (kind === 'text' && wordLike && asciiPunctuationChainSegmentRe.test(text)) {
      const mergedParts = [text]
      let endsWithJoiners = asciiPunctuationChainTrailingJoinersRe.test(text)
      let j = i + 1

      while (
        endsWithJoiners &&
        j < segmentation.len &&
        segmentation.kinds[j] === 'text' &&
        segmentation.isWordLike[j] &&
        asciiPunctuationChainSegmentRe.test(segmentation.texts[j]!)
      ) {
        const nextText = segmentation.texts[j]!
        mergedParts.push(nextText)
        endsWithJoiners = asciiPunctuationChainTrailingJoinersRe.test(nextText)
        j++
      }

      texts.push(joinTextParts(mergedParts))
      isWordLike.push(true)
      kinds.push('text')
      starts.push(segmentation.starts[i]!)
      i = j - 1
      continue
    }

    texts.push(text)
    isWordLike.push(wordLike)
    kinds.push(kind)
    starts.push(segmentation.starts[i]!)
  }

  return {
    len: texts.length,
    texts,
    isWordLike,
    kinds,
    starts,
  }
}

export function splitHyphenatedNumericRuns(segmentation: MergedSegmentation): MergedSegmentation {
  const texts: string[] = []
  const isWordLike: boolean[] = []
  const kinds: SegmentBreakKind[] = []
  const starts: number[] = []

  for (let i = 0; i < segmentation.len; i++) {
    const text = segmentation.texts[i]!
    if (segmentation.kinds[i] === 'text' && text.includes('-')) {
      const parts = text.split('-')
      let shouldSplit = parts.length > 1
      for (let j = 0; j < parts.length; j++) {
        const part = parts[j]!
        if (!shouldSplit) break
        if (
          part.length === 0 ||
          !segmentContainsDecimalDigit(part) ||
          !isNumericRunSegment(part)
        ) {
          shouldSplit = false
        }
      }

      if (shouldSplit) {
        let offset = 0
        for (let j = 0; j < parts.length; j++) {
          const part = parts[j]!
          const splitText = j < parts.length - 1 ? `${part}-` : part
          texts.push(splitText)
          isWordLike.push(true)
          kinds.push('text')
          starts.push(segmentation.starts[i]! + offset)
          offset += splitText.length
        }
        continue
      }
    }

    texts.push(text)
    isWordLike.push(segmentation.isWordLike[i]!)
    kinds.push(segmentation.kinds[i]!)
    starts.push(segmentation.starts[i]!)
  }

  return {
    len: texts.length,
    texts,
    isWordLike,
    kinds,
    starts,
  }
}
