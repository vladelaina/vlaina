import { isCJK } from './analysisCodePoints'
import { canContinueKeepAllTextRun } from './analysisPunctuation'
import type { MergedSegmentation, SegmentBreakKind } from './analysisTypes'

function containsCJKText(text: string): boolean {
  return isCJK(text)
}

export function mergeKeepAllTextSegments(
  normalized: string,
  segmentation: MergedSegmentation,
  breakAfterPunctuation: boolean,
): MergedSegmentation {
  if (segmentation.len <= 1) return segmentation

  const texts: string[] = []
  const isWordLike: boolean[] = []
  const kinds: SegmentBreakKind[] = []
  const starts: number[] = []

  let groupStart = -1
  let groupContainsCJK = false

  function pushOriginalText(index: number): void {
    texts.push(segmentation.texts[index]!)
    isWordLike.push(segmentation.isWordLike[index]!)
    kinds.push('text')
    starts.push(segmentation.starts[index]!)
  }

  function pushMergedText(start: number, end: number): void {
    let wordLike = false

    for (let i = start; i < end; i++) {
      wordLike = wordLike || segmentation.isWordLike[i]!
    }

    const sourceStart = segmentation.starts[start]!
    const sourceEnd = end < segmentation.len ? segmentation.starts[end]! : normalized.length
    texts.push(normalized.slice(sourceStart, sourceEnd))
    isWordLike.push(wordLike)
    kinds.push('text')
    starts.push(sourceStart)
  }

  function flushGroup(end: number): void {
    if (groupStart < 0) return

    if (groupContainsCJK) {
      if (groupStart + 1 === end) {
        pushOriginalText(groupStart)
      } else {
        pushMergedText(groupStart, end)
      }
    } else {
      for (let i = groupStart; i < end; i++) pushOriginalText(i)
    }

    groupStart = -1
    groupContainsCJK = false
  }

  for (let i = 0; i < segmentation.len; i++) {
    const text = segmentation.texts[i]!
    const kind = segmentation.kinds[i]!

    if (kind === 'text') {
      if (
        groupStart >= 0 &&
        !canContinueKeepAllTextRun(segmentation.texts[i - 1]!, breakAfterPunctuation)
      ) {
        flushGroup(i)
      }
      if (groupStart < 0) groupStart = i
      groupContainsCJK = groupContainsCJK || containsCJKText(text)
      continue
    }

    flushGroup(i)
    texts.push(text)
    isWordLike.push(segmentation.isWordLike[i]!)
    kinds.push(kind)
    starts.push(segmentation.starts[i]!)
  }

  flushGroup(segmentation.len)

  return {
    len: texts.length,
    texts,
    isWordLike,
    kinds,
    starts,
  }
}
