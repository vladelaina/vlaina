import {
  buildLineTextFromRange,
  getLineTextCache,
} from './line-text.js'
import { stepRichInlineLine } from './rich-inline-line-walk.js'
import {
  getInternalPreparedRichInline,
  RICH_INLINE_START_CURSOR,
  type PreparedRichInline,
  type PreparedRichInlineItem,
  type RichInlineCursor,
  type RichInlineFragment,
  type RichInlineFragmentRange,
  type RichInlineLine,
  type RichInlineLineRange,
} from './rich-inline-types.js'

export function layoutNextRichInlineLineRange(
  prepared: PreparedRichInline,
  maxWidth: number,
  start: RichInlineCursor = RICH_INLINE_START_CURSOR,
): RichInlineLineRange | null {
  const flow = getInternalPreparedRichInline(prepared)
  const end: RichInlineCursor = {
    itemIndex: start.itemIndex,
    segmentIndex: start.segmentIndex,
    graphemeIndex: start.graphemeIndex,
  }
  const fragments: RichInlineFragmentRange[] = []
  const width = stepRichInlineLine(flow, maxWidth, end, (item, gapBefore, occupiedWidth, fragmentStart, fragmentEnd) => {
    fragments.push({
      itemIndex: item.sourceItemIndex,
      gapBefore,
      occupiedWidth,
      start: fragmentStart,
      end: fragmentEnd,
    })
  })
  if (width === null) return null

  return {
    fragments,
    width,
    end,
  }
}

function materializeFragmentText(
  item: PreparedRichInlineItem,
  fragment: RichInlineFragmentRange,
): string {
  return buildLineTextFromRange(
    item.prepared,
    getLineTextCache(item.prepared),
    fragment.start.segmentIndex,
    fragment.start.graphemeIndex,
    fragment.end.segmentIndex,
    fragment.end.graphemeIndex,
  )
}

export function materializeRichInlineLineRange(
  prepared: PreparedRichInline,
  line: RichInlineLineRange,
): RichInlineLine {
  const flow = getInternalPreparedRichInline(prepared)
  const fragments: RichInlineFragment[] = []

  for (let i = 0; i < line.fragments.length; i++) {
    const fragment = line.fragments[i]!
    const item = flow.itemsBySourceItemIndex[fragment.itemIndex]
    if (item === undefined) throw new Error('Missing rich-text inline item for fragment')
    fragments.push({
      itemIndex: fragment.itemIndex,
      text: materializeFragmentText(item, fragment),
      gapBefore: fragment.gapBefore,
      occupiedWidth: fragment.occupiedWidth,
      start: fragment.start,
      end: fragment.end,
    })
  }

  return {
    fragments,
    width: line.width,
    end: line.end,
  }
}

export function walkRichInlineLineRanges(
  prepared: PreparedRichInline,
  maxWidth: number,
  onLine: (line: RichInlineLineRange) => void,
): number {
  let lineCount = 0
  let cursor = RICH_INLINE_START_CURSOR

  while (true) {
    const line = layoutNextRichInlineLineRange(prepared, maxWidth, cursor)
    if (line === null) return lineCount
    onLine(line)
    lineCount++
    cursor = line.end
  }
}
