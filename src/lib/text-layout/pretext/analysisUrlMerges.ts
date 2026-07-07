import { isTextRunBoundary, joinTextParts } from './analysisSegments'
import type { MergedSegmentation, SegmentBreakKind } from './analysisTypes'

const urlSchemeSegmentRe = /^[A-Za-z][A-Za-z0-9+.-]*:$/

function isUrlLikeRunStart(segmentation: MergedSegmentation, index: number): boolean {
  const text = segmentation.texts[index]!
  if (text.startsWith('www.')) return true
  return (
    urlSchemeSegmentRe.test(text) &&
    index + 1 < segmentation.len &&
    segmentation.kinds[index + 1] === 'text' &&
    segmentation.texts[index + 1] === '//'
  )
}

function isUrlQueryBoundarySegment(text: string): boolean {
  return text.includes('?') && (text.includes('://') || text.startsWith('www.'))
}

export function mergeUrlLikeRuns(segmentation: MergedSegmentation): MergedSegmentation {
  const texts = segmentation.texts.slice()
  const isWordLike = segmentation.isWordLike.slice()
  const kinds = segmentation.kinds.slice()
  const starts = segmentation.starts.slice()

  for (let i = 0; i < segmentation.len; i++) {
    if (kinds[i] !== 'text' || !isUrlLikeRunStart(segmentation, i)) continue

    const mergedParts = [texts[i]!]
    let j = i + 1
    while (j < segmentation.len && !isTextRunBoundary(kinds[j]!)) {
      mergedParts.push(texts[j]!)
      isWordLike[i] = true
      const endsQueryPrefix = texts[j]!.includes('?')
      kinds[j] = 'text'
      texts[j] = ''
      j++
      if (endsQueryPrefix) break
    }
    texts[i] = joinTextParts(mergedParts)
  }

  let compactLen = 0
  for (let read = 0; read < texts.length; read++) {
    const text = texts[read]!
    if (text.length === 0) continue
    if (compactLen !== read) {
      texts[compactLen] = text
      isWordLike[compactLen] = isWordLike[read]!
      kinds[compactLen] = kinds[read]!
      starts[compactLen] = starts[read]!
    }
    compactLen++
  }

  texts.length = compactLen
  isWordLike.length = compactLen
  kinds.length = compactLen
  starts.length = compactLen

  return {
    len: compactLen,
    texts,
    isWordLike,
    kinds,
    starts,
  }
}

export function mergeUrlQueryRuns(segmentation: MergedSegmentation): MergedSegmentation {
  const texts: string[] = []
  const isWordLike: boolean[] = []
  const kinds: SegmentBreakKind[] = []
  const starts: number[] = []

  for (let i = 0; i < segmentation.len; i++) {
    const text = segmentation.texts[i]!
    texts.push(text)
    isWordLike.push(segmentation.isWordLike[i]!)
    kinds.push(segmentation.kinds[i]!)
    starts.push(segmentation.starts[i]!)

    if (!isUrlQueryBoundarySegment(text)) continue

    const nextIndex = i + 1
    if (
      nextIndex >= segmentation.len ||
      isTextRunBoundary(segmentation.kinds[nextIndex]!)
    ) {
      continue
    }

    const queryParts: string[] = []
    const queryStart = segmentation.starts[nextIndex]!
    let j = nextIndex
    while (j < segmentation.len && !isTextRunBoundary(segmentation.kinds[j]!)) {
      queryParts.push(segmentation.texts[j]!)
      j++
    }

    if (queryParts.length > 0) {
      texts.push(joinTextParts(queryParts))
      isWordLike.push(true)
      kinds.push('text')
      starts.push(queryStart)
      i = j - 1
    }
  }

  return {
    len: texts.length,
    texts,
    isWordLike,
    kinds,
    starts,
  }
}
