import type { Ref } from 'vue'

import { onBeforeUnmount, onMounted } from 'vue'

import {
  forgetTableScroll,
  peekTableScroll,
  type TableScrollSnapshot,
} from './table-scroll-memory'

export function resolveTableWideLayoutMetrics({
  baseWidth,
  leftReach,
  rightReach,
  naturalWidth,
}: {
  baseWidth: number
  leftReach: number
  rightReach: number
  naturalWidth: number
}) {
  const isWideLayout = naturalWidth > baseWidth + 1

  return {
    maxWidth: isWideLayout ? baseWidth + leftReach + rightReach : baseWidth,
    bleedLeft: isWideLayout ? leftReach : 0,
    scrollStart: isWideLayout ? leftReach : 0,
    scrollEnd: isWideLayout ? rightReach : 0,
    tableMinWidth: isWideLayout ? '0px' : '100%',
  }
}

export function resolveTableScrollRestorePosition({
  clientWidth,
  clientHeight,
  scrollWidth,
  scrollHeight,
  snapshot,
}: {
  clientWidth: number
  clientHeight: number
  scrollWidth: number
  scrollHeight: number
  snapshot: TableScrollSnapshot
}) {
  const maxScrollLeft = Math.max(0, scrollWidth - clientWidth)
  const maxScrollTop = Math.max(0, scrollHeight - clientHeight)

  return {
    left: snapshot.stickToRight
      ? maxScrollLeft
      : Math.max(0, Math.min(snapshot.scrollLeft, maxScrollLeft)),
    top: Math.max(0, Math.min(snapshot.scrollTop, maxScrollTop)),
  }
}

export function resolveTableEdgeZoneLayout({
  wrapperRect,
  contentRect,
  rowEdgeZoneSize,
  colEdgeZoneSize,
  cornerEdgeZoneInset,
}: {
  wrapperRect: Pick<DOMRect, 'left' | 'top'>
  contentRect: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>
  rowEdgeZoneSize: number
  colEdgeZoneSize: number
  cornerEdgeZoneInset: number
}) {
  const left = contentRect.left - wrapperRect.left
  const top = contentRect.top - wrapperRect.top
  const width = contentRect.width
  const height = contentRect.height

  return {
    bottom: {
      left,
      top: top + height - rowEdgeZoneSize / 2,
      width,
    },
    right: {
      top,
      left: left + width - colEdgeZoneSize / 2,
      height,
    },
    corner: {
      top: top + height - cornerEdgeZoneInset,
      left: left + width - cornerEdgeZoneInset,
    },
  }
}

type UseTableBlockLayoutOptions = {
  rowEdgeZoneSize: number
  colEdgeZoneSize: number
  cornerEdgeZoneInset: number
  rootRef: Ref<HTMLDivElement | undefined>
  tableWrapperRef: Ref<HTMLDivElement | undefined>
  tableScrollRef: Ref<HTMLDivElement | undefined>
  contentWrapperRef: Ref<HTMLElement | undefined>
  bottomEdgeZoneRef: Ref<HTMLDivElement | undefined>
  rightEdgeZoneRef: Ref<HTMLDivElement | undefined>
  cornerEdgeZoneRef: Ref<HTMLDivElement | undefined>
  ensureContentHost: () => boolean
  getTableKey: () => number | undefined
  syncColumnHeaderControls: () => void
}

export function useTableBlockLayout({
  rowEdgeZoneSize,
  colEdgeZoneSize,
  cornerEdgeZoneInset,
  rootRef,
  tableWrapperRef,
  tableScrollRef,
  contentWrapperRef,
  bottomEdgeZoneRef,
  rightEdgeZoneRef,
  cornerEdgeZoneRef,
  ensureContentHost,
  getTableKey,
  syncColumnHeaderControls,
}: UseTableBlockLayoutOptions) {
  let resizeObserver: ResizeObserver | undefined
  let observedScrollRoot: HTMLElement | undefined
  let observedContent: HTMLElement | undefined
  let syncFrame = 0

  const resolveScrollRoot = () => {
    const root = rootRef.value
    const closestScrollRoot = root?.closest('[data-note-scroll-root="true"]')
    return closestScrollRoot instanceof HTMLElement ? closestScrollRoot : undefined
  }

  const syncObservedTargets = () => {
    if (!resizeObserver) return resolveScrollRoot()

    const scrollRoot = resolveScrollRoot()
    if (observedScrollRoot !== scrollRoot) {
      if (observedScrollRoot) resizeObserver.unobserve(observedScrollRoot)
      if (scrollRoot) resizeObserver.observe(scrollRoot)
      observedScrollRoot = scrollRoot
    }

    const content = contentWrapperRef.value
    if (observedContent !== content) {
      if (observedContent) resizeObserver.unobserve(observedContent)
      if (content) resizeObserver.observe(content)
      observedContent = content
    }

    return scrollRoot
  }

  const syncWideLayout = () => {
    const root = rootRef.value
    const wrapper = tableWrapperRef.value
    const scroll = tableScrollRef.value
    if (!root || !wrapper || !scroll) return

    ensureContentHost()

    const content = contentWrapperRef.value
    if (!content) return

    const scrollRoot = syncObservedTargets()
    const rootRect = root.getBoundingClientRect()
    const scrollRootRect = scrollRoot?.getBoundingClientRect()
    const metrics = resolveTableWideLayoutMetrics({
      baseWidth: rootRect.width,
      leftReach: scrollRootRect
        ? Math.max(0, rootRect.left - scrollRootRect.left)
        : 0,
      rightReach: scrollRootRect
        ? Math.max(0, scrollRootRect.right - rootRect.right)
        : 0,
      naturalWidth: Math.ceil(content.scrollWidth),
    })

    wrapper.style.setProperty('--table-block-max-width', `${metrics.maxWidth}px`)
    wrapper.style.setProperty(
      '--table-block-bleed-left',
      `${metrics.bleedLeft}px`
    )
    wrapper.style.setProperty(
      '--table-block-scroll-start',
      `${metrics.scrollStart}px`
    )
    wrapper.style.setProperty(
      '--table-block-scroll-end',
      `${metrics.scrollEnd}px`
    )
    wrapper.style.setProperty(
      '--table-block-table-min-width',
      metrics.tableMinWidth
    )

    if (scroll.clientWidth === 0 || scroll.scrollWidth === 0) return

    const tableKey = getTableKey()
    const pendingScroll = peekTableScroll(tableKey)
    if (!pendingScroll) return

    const restoredScroll = resolveTableScrollRestorePosition({
      clientWidth: scroll.clientWidth,
      clientHeight: scroll.clientHeight,
      scrollWidth: scroll.scrollWidth,
      scrollHeight: scroll.scrollHeight,
      snapshot: pendingScroll,
    })

    if (
      Math.abs(scroll.scrollLeft - restoredScroll.left) > 1 ||
      Math.abs(scroll.scrollTop - restoredScroll.top) > 1
    ) {
      scroll.scrollLeft = restoredScroll.left
      scroll.scrollTop = restoredScroll.top
    }
    forgetTableScroll(tableKey)
  }

  const syncEdgeCreateZones = () => {
    syncWideLayout()
    syncColumnHeaderControls()

    const wrapper = tableWrapperRef.value
    const bottomZone = bottomEdgeZoneRef.value
    const rightZone = rightEdgeZoneRef.value
    const cornerZone = cornerEdgeZoneRef.value
    if (!wrapper) return

    ensureContentHost()

    const content = contentWrapperRef.value
    if (!content) return

    const zoneLayout = resolveTableEdgeZoneLayout({
      wrapperRect: wrapper.getBoundingClientRect(),
      contentRect: content.getBoundingClientRect(),
      rowEdgeZoneSize,
      colEdgeZoneSize,
      cornerEdgeZoneInset,
    })

    if (bottomZone) {
      Object.assign(bottomZone.style, {
        left: `${zoneLayout.bottom.left}px`,
        top: `${zoneLayout.bottom.top}px`,
        width: `${zoneLayout.bottom.width}px`,
      })
    }

    if (rightZone) {
      Object.assign(rightZone.style, {
        top: `${zoneLayout.right.top}px`,
        left: `${zoneLayout.right.left}px`,
        height: `${zoneLayout.right.height}px`,
      })
    }

    if (cornerZone) {
      Object.assign(cornerZone.style, {
        top: `${zoneLayout.corner.top}px`,
        left: `${zoneLayout.corner.left}px`,
      })
    }

  }

  const queueLayoutSync = () => {
    if (typeof window === 'undefined') return
    if (syncFrame !== 0) return

    syncFrame = window.requestAnimationFrame(() => {
      syncFrame = 0
      syncEdgeCreateZones()
    })
  }

  onMounted(() => {
    window.addEventListener('resize', syncEdgeCreateZones)
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(() => {
        syncEdgeCreateZones()
      })

      if (tableWrapperRef.value) resizeObserver.observe(tableWrapperRef.value)
      if (tableScrollRef.value) resizeObserver.observe(tableScrollRef.value)
      syncObservedTargets()
    }

    queueLayoutSync()
  })

  onBeforeUnmount(() => {
    window.removeEventListener('resize', syncEdgeCreateZones)
    if (syncFrame !== 0) {
      window.cancelAnimationFrame(syncFrame)
      syncFrame = 0
    }
    if (observedScrollRoot) resizeObserver?.unobserve(observedScrollRoot)
    if (observedContent) resizeObserver?.unobserve(observedContent)
    resizeObserver?.disconnect()
  })

  return {
    queueLayoutSync,
    syncEdgeCreateZones,
  }
}
