import { useCallback, useEffect, useRef, type RefObject } from 'react'

type ScrollMode = 'none' | 'center' | 'nearest'

interface UseModelSelectorScrollParams {
  isOpen: boolean
  focusedModelId: string | null
  listRef: RefObject<HTMLDivElement | null>
  onDebugLog?: (message: string, payload?: Record<string, unknown>) => void
}

export function useModelSelectorScroll({
  isOpen,
  focusedModelId,
  listRef,
  onDebugLog,
}: UseModelSelectorScrollParams) {
  const scrollModeRef = useRef<ScrollMode>('none')

  const requestCenterScroll = useCallback(() => {
    scrollModeRef.current = 'center'
  }, [])

  const requestNearestScroll = useCallback(() => {
    scrollModeRef.current = 'nearest'
  }, [])

  const clearScrollMode = useCallback(() => {
    scrollModeRef.current = 'none'
  }, [])

  useEffect(() => {
    if (!isOpen || !focusedModelId || !listRef.current) {
      return
    }

    const scrollMode = scrollModeRef.current
    if (scrollMode === 'none') {
      return
    }

    const list = listRef.current
    const activeItem = list.querySelector(`[data-model-id="${focusedModelId}"]`) as HTMLElement | null
    if (!activeItem) {
      scrollModeRef.current = 'none'
      return
    }

    const itemTop = activeItem.offsetTop
    const itemBottom = itemTop + activeItem.offsetHeight

    if (scrollMode === 'center') {
      const targetScrollTop = itemTop - (list.clientHeight / 2) + (activeItem.offsetHeight / 2)
      const maxScrollTop = Math.max(0, list.scrollHeight - list.clientHeight)
      const nextScrollTop = Math.max(0, Math.min(maxScrollTop, targetScrollTop))
      onDebugLog?.('scroll-center', {
        focusedModelId,
        from: list.scrollTop,
        to: nextScrollTop,
        listHeight: list.clientHeight,
        itemTop,
        itemHeight: activeItem.offsetHeight,
      })
      list.scrollTop = nextScrollTop
      scrollModeRef.current = 'none'
      return
    }

    if (scrollMode !== 'nearest') {
      return
    }

    const viewTop = list.scrollTop
    const viewBottom = viewTop + list.clientHeight
    if (itemTop < viewTop) {
      onDebugLog?.('scroll-nearest-up', { focusedModelId, from: viewTop, to: itemTop })
      list.scrollTop = itemTop
    } else if (itemBottom > viewBottom) {
      const nextScrollTop = itemBottom - list.clientHeight
      onDebugLog?.('scroll-nearest-down', { focusedModelId, from: viewTop, to: nextScrollTop })
      list.scrollTop = nextScrollTop
    }
    scrollModeRef.current = 'none'
  }, [focusedModelId, isOpen, listRef, onDebugLog])

  return {
    requestCenterScroll,
    requestNearestScroll,
    clearScrollMode,
  }
}
