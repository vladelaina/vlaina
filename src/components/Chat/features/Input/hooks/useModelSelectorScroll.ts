import { useCallback, useEffect, useRef } from 'react'

type ScrollMode = 'none' | 'center' | 'nearest'

interface UseModelSelectorScrollParams {
  isOpen: boolean
  focusedIndex: number
  scrollToIndex: (index: number, align: 'auto' | 'center') => void
  onDebugLog?: (message: string, payload?: Record<string, unknown>) => void
}

export function useModelSelectorScroll({
  isOpen,
  focusedIndex,
  scrollToIndex,
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
    if (!isOpen || focusedIndex < 0) {
      return
    }

    const scrollMode = scrollModeRef.current
    if (scrollMode === 'none') {
      return
    }

    if (scrollMode === 'center') {
      onDebugLog?.('scroll-center', {
        focusedIndex,
      })
      scrollToIndex(focusedIndex, 'center')
      scrollModeRef.current = 'none'
      return
    }

    if (scrollMode !== 'nearest') {
      return
    }

    onDebugLog?.('scroll-nearest', {
      focusedIndex,
    })
    scrollToIndex(focusedIndex, 'auto')
    scrollModeRef.current = 'none'
  }, [focusedIndex, isOpen, onDebugLog, scrollToIndex])

  return {
    requestCenterScroll,
    requestNearestScroll,
    clearScrollMode,
  }
}
