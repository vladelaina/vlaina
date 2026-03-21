import type { DragSessionEvent } from './drag-session'
import type { EdgeCreateAxis } from './edge-create-state'
import type { Refs } from './types'

export type EdgeCreateScrollSource = HTMLElement | Window

const SCROLL_ROOT_SELECTOR = '[data-note-scroll-root="true"]'
const WHEEL_DELTA_MODE_LINE = 1
const WHEEL_DELTA_MODE_PAGE = 2
const WHEEL_LINE_HEIGHT_PX = 16

function getWindowScrollOffset(axis: EdgeCreateAxis) {
  if (typeof window === 'undefined') return 0
  return axis === 'row' ? window.scrollY : window.scrollX
}

function isWindowScrollSource(
  source: EdgeCreateScrollSource | null
): source is Window {
  return typeof window !== 'undefined' && source === window
}

export function resolveEdgeCreateScrollSource(
  refs: Refs,
  axis: EdgeCreateAxis
): EdgeCreateScrollSource | null {
  if (axis === 'col') {
    return refs.tableScrollRef?.value ?? (typeof window !== 'undefined' ? window : null)
  }

  const root = refs.rootRef?.value
  const scrollRoot = root?.closest(SCROLL_ROOT_SELECTOR)
  if (scrollRoot instanceof HTMLElement) return scrollRoot

  return typeof window !== 'undefined' ? window : null
}

export function readEdgeCreateClientCoord(
  event: DragSessionEvent,
  axis: EdgeCreateAxis
) {
  return axis === 'row' ? event.clientY : event.clientX
}

export function readEdgeCreateScrollOffset(
  source: EdgeCreateScrollSource | null,
  axis: EdgeCreateAxis
) {
  if (!source) return 0
  if (isWindowScrollSource(source)) return getWindowScrollOffset(axis)
  return axis === 'row' ? source.scrollTop : source.scrollLeft
}

export function readEdgeCreateAbsoluteCoord(args: {
  axis: EdgeCreateAxis
  clientCoord: number
  scrollSource: EdgeCreateScrollSource | null
}) {
  return (
    args.clientCoord + readEdgeCreateScrollOffset(args.scrollSource, args.axis)
  )
}

export function readEdgeCreateViewportSize(
  source: EdgeCreateScrollSource | null,
  axis: EdgeCreateAxis
) {
  if (!source) return 0
  if (isWindowScrollSource(source)) {
    return axis === 'row' ? window.innerHeight : window.innerWidth
  }
  return axis === 'row' ? source.clientHeight : source.clientWidth
}

export function readEdgeCreateViewportRect(
  source: EdgeCreateScrollSource | null
) {
  if (!source) return null
  if (isWindowScrollSource(source)) {
    return {
      left: 0,
      top: 0,
      right: window.innerWidth,
      bottom: window.innerHeight,
      width: window.innerWidth,
      height: window.innerHeight,
    }
  }
  return source.getBoundingClientRect()
}

export function normalizeEdgeCreateWheelDelta(
  delta: number,
  deltaMode: number,
  pageSize: number
) {
  if (deltaMode === WHEEL_DELTA_MODE_LINE) return delta * WHEEL_LINE_HEIGHT_PX
  if (deltaMode === WHEEL_DELTA_MODE_PAGE) return delta * pageSize
  return delta
}

export function readEdgeCreateWheelDelta(
  event: WheelEvent,
  axis: EdgeCreateAxis,
  scrollSource: EdgeCreateScrollSource | null
) {
  const delta =
    axis === 'row'
      ? event.deltaY
      : event.deltaX !== 0
        ? event.deltaX
        : event.shiftKey
          ? event.deltaY
          : 0

  return normalizeEdgeCreateWheelDelta(
    delta,
    event.deltaMode,
    readEdgeCreateViewportSize(scrollSource, axis)
  )
}

export function scrollEdgeCreateSourceBy(args: {
  axis: EdgeCreateAxis
  delta: number
  scrollSource: EdgeCreateScrollSource | null
}) {
  const { axis, delta, scrollSource } = args
  if (!scrollSource || delta === 0) return false

  if (isWindowScrollSource(scrollSource)) {
    const before = getWindowScrollOffset(axis)
    if (axis === 'row') {
      window.scrollTo(window.scrollX, before + delta)
    } else {
      window.scrollTo(before + delta, window.scrollY)
    }
    return getWindowScrollOffset(axis) !== before
  }

  const before = axis === 'row' ? scrollSource.scrollTop : scrollSource.scrollLeft
  const max =
    axis === 'row'
      ? Math.max(0, scrollSource.scrollHeight - scrollSource.clientHeight)
      : Math.max(0, scrollSource.scrollWidth - scrollSource.clientWidth)
  const next = Math.max(0, Math.min(before + delta, max))
  if (next === before) return false

  if (axis === 'row') {
    scrollSource.scrollTop = next
  } else {
    scrollSource.scrollLeft = next
  }

  return true
}

export function resolveEdgeCreateAutoScrollDelta(args: {
  axis: EdgeCreateAxis
  clientCoord: number
  scrollSource: EdgeCreateScrollSource | null
  edgeSize?: number
  maxStep?: number
}) {
  const { axis, clientCoord, scrollSource } = args
  const edgeSize = args.edgeSize ?? 72
  const maxStep = args.maxStep ?? 28
  const rect = readEdgeCreateViewportRect(scrollSource)
  if (!rect) return 0

  const start = axis === 'row' ? rect.top : rect.left
  const end = axis === 'row' ? rect.bottom : rect.right
  const size = axis === 'row' ? rect.height : rect.width
  if (size <= 1) return 0

  if (clientCoord <= start + edgeSize) {
    const intensity = Math.max(1, start + edgeSize - clientCoord)
    return -Math.min(maxStep, Math.ceil(intensity / 3))
  }

  if (clientCoord >= end - edgeSize) {
    const intensity = Math.max(1, clientCoord - (end - edgeSize))
    return Math.min(maxStep, Math.ceil(intensity / 3))
  }

  return 0
}
