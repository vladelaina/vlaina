import { measureNaturalWidth, prepareWithSegments, type PreparedTextWithSegments } from './layout.js'
import { stepPreparedLineGeometry, type LineBreakCursor } from './line-break.js'
import {
  type InternalPreparedRichInline,
  type PreparedRichInline,
  type PreparedRichInlineItem,
  type RichInlineItem,
} from './rich-inline-types.js'

const COLLAPSIBLE_BOUNDARY_RE = /[ \t\n\f\r]+/
const LEADING_COLLAPSIBLE_BOUNDARY_RE = /^[ \t\n\f\r]+/
const TRAILING_COLLAPSIBLE_BOUNDARY_RE = /[ \t\n\f\r]+$/

function getCollapsedSpaceWidth(font: string, letterSpacing: number, cache: Map<string, number>): number {
  const cacheKey = `${font}\u0000${letterSpacing}`
  const cached = cache.get(cacheKey)
  if (cached !== undefined) return cached

  const options = letterSpacing === 0 ? undefined : { letterSpacing }
  const joinedWidth = measureNaturalWidth(prepareWithSegments('A A', font, options))
  const compactWidth = measureNaturalWidth(prepareWithSegments('AA', font, options))
  const collapsedWidth = Math.max(0, joinedWidth - compactWidth)
  cache.set(cacheKey, collapsedWidth)
  return collapsedWidth
}

function prepareWholeItemLine(prepared: PreparedTextWithSegments): {
  endGraphemeIndex: number
  endSegmentIndex: number
  width: number
} | null {
  const end: LineBreakCursor = { segmentIndex: 0, graphemeIndex: 0 }
  const width = stepPreparedLineGeometry(prepared, end, Number.POSITIVE_INFINITY)
  if (width === null) return null
  return {
    endGraphemeIndex: end.graphemeIndex,
    endSegmentIndex: end.segmentIndex,
    width,
  }
}

export function prepareRichInline(items: RichInlineItem[]): PreparedRichInline {
  const preparedItems: PreparedRichInlineItem[] = []
  const itemsBySourceItemIndex = Array.from<PreparedRichInlineItem | undefined>({ length: items.length })
  const collapsedSpaceWidthCache = new Map<string, number>()
  let pendingGapWidth = 0

  for (let index = 0; index < items.length; index++) {
    const item = items[index]!
    const letterSpacing = item.letterSpacing ?? 0
    const hasLeadingWhitespace = LEADING_COLLAPSIBLE_BOUNDARY_RE.test(item.text)
    const hasTrailingWhitespace = TRAILING_COLLAPSIBLE_BOUNDARY_RE.test(item.text)
    const trimmedText = item.text
      .replace(LEADING_COLLAPSIBLE_BOUNDARY_RE, '')
      .replace(TRAILING_COLLAPSIBLE_BOUNDARY_RE, '')

    if (trimmedText.length === 0) {
      if (COLLAPSIBLE_BOUNDARY_RE.test(item.text) && pendingGapWidth === 0) {
        pendingGapWidth = getCollapsedSpaceWidth(item.font, letterSpacing, collapsedSpaceWidthCache)
      }
      continue
    }

    const gapBefore =
      pendingGapWidth > 0
        ? pendingGapWidth
        : hasLeadingWhitespace
          ? getCollapsedSpaceWidth(item.font, letterSpacing, collapsedSpaceWidthCache)
          : 0
    const prepared = prepareWithSegments(
      trimmedText,
      item.font,
      letterSpacing === 0 ? undefined : { letterSpacing },
    )
    const wholeLine = prepareWholeItemLine(prepared)
    if (wholeLine === null) {
      pendingGapWidth = hasTrailingWhitespace
        ? getCollapsedSpaceWidth(item.font, letterSpacing, collapsedSpaceWidthCache)
        : 0
      continue
    }

    const preparedItem = {
      break: item.break ?? 'normal',
      endGraphemeIndex: wholeLine.endGraphemeIndex,
      endSegmentIndex: wholeLine.endSegmentIndex,
      extraWidth: item.extraWidth ?? 0,
      gapBefore,
      naturalWidth: wholeLine.width,
      prepared,
      sourceItemIndex: index,
    } satisfies PreparedRichInlineItem
    preparedItems.push(preparedItem)
    itemsBySourceItemIndex[index] = preparedItem

    pendingGapWidth = hasTrailingWhitespace
      ? getCollapsedSpaceWidth(item.font, letterSpacing, collapsedSpaceWidthCache)
      : 0
  }

  return {
    items: preparedItems,
    itemsBySourceItemIndex,
  } as InternalPreparedRichInline
}
