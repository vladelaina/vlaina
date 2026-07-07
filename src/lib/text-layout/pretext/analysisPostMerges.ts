import { isCJK } from './analysisCodePoints'
import { mergeGlueConnectedTextRuns } from './analysisGlueMerges'
import {
  mergeAsciiPunctuationChains,
  mergeNumericRuns,
  splitHyphenatedNumericRuns,
} from './analysisNumericMerges'
import { splitTrailingForwardStickyCluster } from './analysisPunctuation'
import type { MergedSegmentation } from './analysisTypes'
import { mergeUrlLikeRuns, mergeUrlQueryRuns } from './analysisUrlMerges'

function carryTrailingForwardStickyAcrossCJKBoundary(segmentation: MergedSegmentation): MergedSegmentation {
  const texts = segmentation.texts.slice()
  const isWordLike = segmentation.isWordLike.slice()
  const kinds = segmentation.kinds.slice()
  const starts = segmentation.starts.slice()

  for (let i = 0; i < texts.length - 1; i++) {
    if (kinds[i] !== 'text' || kinds[i + 1] !== 'text') continue
    if (!isCJK(texts[i]!) || !isCJK(texts[i + 1]!)) continue

    const split = splitTrailingForwardStickyCluster(texts[i]!)
    if (split === null) continue

    texts[i] = split.head
    texts[i + 1] = split.tail + texts[i + 1]!
    starts[i + 1] = starts[i]! + split.head.length
  }

  return {
    len: texts.length,
    texts,
    isWordLike,
    kinds,
    starts,
  }
}

export function applyPostCompactionMerges(segmentation: MergedSegmentation): MergedSegmentation {
  const compacted = mergeGlueConnectedTextRuns(segmentation)
  return carryTrailingForwardStickyAcrossCJKBoundary(
    mergeAsciiPunctuationChains(
      splitHyphenatedNumericRuns(mergeNumericRuns(mergeUrlQueryRuns(mergeUrlLikeRuns(compacted)))),
    ),
  )
}
