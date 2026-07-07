import type { AnalysisChunk, MergedSegmentation, WhiteSpaceProfile } from './analysisTypes'

export function compileAnalysisChunks(
  segmentation: MergedSegmentation,
  whiteSpaceProfile: WhiteSpaceProfile,
): AnalysisChunk[] {
  if (segmentation.len === 0) return []
  if (!whiteSpaceProfile.preserveHardBreaks) {
    return [{
      startSegmentIndex: 0,
      endSegmentIndex: segmentation.len,
      consumedEndSegmentIndex: segmentation.len,
    }]
  }

  const chunks: AnalysisChunk[] = []
  let startSegmentIndex = 0

  for (let i = 0; i < segmentation.len; i++) {
    if (segmentation.kinds[i] !== 'hard-break') continue

    chunks.push({
      startSegmentIndex,
      endSegmentIndex: i,
      consumedEndSegmentIndex: i + 1,
    })
    startSegmentIndex = i + 1
  }

  if (startSegmentIndex < segmentation.len) {
    chunks.push({
      startSegmentIndex,
      endSegmentIndex: segmentation.len,
      consumedEndSegmentIndex: segmentation.len,
    })
  }

  return chunks
}
