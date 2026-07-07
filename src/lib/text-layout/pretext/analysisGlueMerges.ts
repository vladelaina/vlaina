import { joinTextParts } from './analysisSegments'
import type { MergedSegmentation, SegmentBreakKind } from './analysisTypes'

export function mergeGlueConnectedTextRuns(segmentation: MergedSegmentation): MergedSegmentation {
  const texts: string[] = []
  const isWordLike: boolean[] = []
  const kinds: SegmentBreakKind[] = []
  const starts: number[] = []

  let read = 0
  while (read < segmentation.len) {
    const textParts = [segmentation.texts[read]!]
    let wordLike = segmentation.isWordLike[read]!
    let kind = segmentation.kinds[read]!
    let start = segmentation.starts[read]!

    if (kind === 'glue') {
      const glueParts = [textParts[0]!]
      const glueStart = start
      read++
      while (read < segmentation.len && segmentation.kinds[read] === 'glue') {
        glueParts.push(segmentation.texts[read]!)
        read++
      }
      const glueText = joinTextParts(glueParts)

      if (read < segmentation.len && segmentation.kinds[read] === 'text') {
        textParts[0] = glueText
        textParts.push(segmentation.texts[read]!)
        wordLike = segmentation.isWordLike[read]!
        kind = 'text'
        start = glueStart
        read++
      } else {
        texts.push(glueText)
        isWordLike.push(false)
        kinds.push('glue')
        starts.push(glueStart)
        continue
      }
    } else {
      read++
    }

    if (kind === 'text') {
      while (read < segmentation.len && segmentation.kinds[read] === 'glue') {
        const glueParts: string[] = []
        while (read < segmentation.len && segmentation.kinds[read] === 'glue') {
          glueParts.push(segmentation.texts[read]!)
          read++
        }
        const glueText = joinTextParts(glueParts)

        if (read < segmentation.len && segmentation.kinds[read] === 'text') {
          textParts.push(glueText, segmentation.texts[read]!)
          wordLike = wordLike || segmentation.isWordLike[read]!
          read++
          continue
        }

        textParts.push(glueText)
      }
    }

    texts.push(joinTextParts(textParts))
    isWordLike.push(wordLike)
    kinds.push(kind)
    starts.push(start)
  }

  return {
    len: texts.length,
    texts,
    isWordLike,
    kinds,
    starts,
  }
}
