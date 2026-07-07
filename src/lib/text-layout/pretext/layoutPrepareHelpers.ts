import type {
  InternalPreparedText,
  PreparedLineChunk,
  PreparedTextWithSegments,
} from './layoutTypes.js'
import type { AnalysisChunk } from './analysis.js'

export function createEmptyPrepared(includeSegments: boolean): InternalPreparedText | PreparedTextWithSegments {
  if (includeSegments) {
    return {
      widths: [],
      lineEndFitAdvances: [],
      lineEndPaintAdvances: [],
      kinds: [],
      simpleLineWalkFastPath: true,
      segLevels: null,
      breakableFitAdvances: [],
      letterSpacing: 0,
      spacingGraphemeCounts: [],
      discretionaryHyphenWidth: 0,
      tabStopAdvance: 0,
      chunks: [],
      segments: [],
    } as unknown as PreparedTextWithSegments
  }
  return {
    widths: [],
    lineEndFitAdvances: [],
    lineEndPaintAdvances: [],
    kinds: [],
    simpleLineWalkFastPath: true,
    segLevels: null,
    breakableFitAdvances: [],
    letterSpacing: 0,
    spacingGraphemeCounts: [],
    discretionaryHyphenWidth: 0,
    tabStopAdvance: 0,
    chunks: [],
  } as unknown as InternalPreparedText
}

export function mapAnalysisChunksToPreparedChunks(
  chunks: AnalysisChunk[],
  preparedStartByAnalysisIndex: number[],
  preparedEndSegmentIndex: number,
): PreparedLineChunk[] {
  const preparedChunks: PreparedLineChunk[] = []
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]!
    const startSegmentIndex =
      chunk.startSegmentIndex < preparedStartByAnalysisIndex.length
        ? preparedStartByAnalysisIndex[chunk.startSegmentIndex]!
        : preparedEndSegmentIndex
    const endSegmentIndex =
      chunk.endSegmentIndex < preparedStartByAnalysisIndex.length
        ? preparedStartByAnalysisIndex[chunk.endSegmentIndex]!
        : preparedEndSegmentIndex
    const consumedEndSegmentIndex =
      chunk.consumedEndSegmentIndex < preparedStartByAnalysisIndex.length
        ? preparedStartByAnalysisIndex[chunk.consumedEndSegmentIndex]!
        : preparedEndSegmentIndex

    preparedChunks.push({
      startSegmentIndex,
      endSegmentIndex,
      consumedEndSegmentIndex,
    })
  }
  return preparedChunks
}
