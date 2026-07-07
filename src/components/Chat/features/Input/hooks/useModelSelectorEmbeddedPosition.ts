import { useCallback, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from 'react'
import {
  MODEL_SELECTOR_DROPDOWN_FALLBACK_MAX_HEIGHT,
  MODEL_SELECTOR_DROPDOWN_MAX_HEIGHT,
  MODEL_SELECTOR_DROPDOWN_WIDTH,
} from '../modelSelectorLayout'

function areEmbeddedDropdownStylesEqual(left: CSSProperties | null, right: CSSProperties): boolean {
  if (left === null) {
    return false
  }

  return (
    left.left === right.left &&
    left.top === right.top &&
    left.width === right.width &&
    left.maxHeight === right.maxHeight
  )
}

interface UseModelSelectorEmbeddedPositionParams {
  isOpen: boolean
  isEmbedded: boolean
  dropdownPlacement: 'top' | 'bottom'
  dropdownAlign: 'left' | 'right'
  dropdownRef: RefObject<HTMLDivElement | null>
  dropdownContentRef: RefObject<HTMLDivElement | null>
}

export function useModelSelectorEmbeddedPosition({
  isOpen,
  isEmbedded,
  dropdownPlacement,
  dropdownAlign,
  dropdownRef,
  dropdownContentRef,
}: UseModelSelectorEmbeddedPositionParams) {
  const embeddedPositionFrameRef = useRef<number | null>(null)
  const [embeddedDropdownStyle, setEmbeddedDropdownStyle] = useState<CSSProperties | null>(null)

  const updateEmbeddedDropdownPosition = useCallback(() => {
      if (!isEmbedded || !dropdownRef.current || typeof window === 'undefined') {
          return
      }

      const triggerRect = dropdownRef.current.getBoundingClientRect()
      const viewportPadding = 12
      const viewportAvailableWidth = Math.max(0, window.innerWidth - viewportPadding * 2)
      const dropdownWidth = Math.min(MODEL_SELECTOR_DROPDOWN_WIDTH, viewportAvailableWidth)
      const measuredHeight = dropdownContentRef.current?.getBoundingClientRect().height ?? 0
      const viewportAvailableHeight = Math.max(0, window.innerHeight - viewportPadding * 2)
      const fallbackHeight = Math.min(
          MODEL_SELECTOR_DROPDOWN_FALLBACK_MAX_HEIGHT,
          Math.max(0, window.innerHeight - 96),
      )
      const dropdownHeight = Math.min(
          measuredHeight > 0 ? measuredHeight : fallbackHeight,
          viewportAvailableHeight,
      )
      const preferredLeft = dropdownAlign === 'left'
          ? triggerRect.left
          : triggerRect.right - dropdownWidth
      const left = Math.max(
          viewportPadding,
          Math.min(
              preferredLeft,
              window.innerWidth - dropdownWidth - viewportPadding,
          ),
      )
      const preferredTop = dropdownPlacement === 'bottom'
          ? triggerRect.bottom + 4
          : triggerRect.top - dropdownHeight - 4
      const maxTop = Math.max(viewportPadding, window.innerHeight - dropdownHeight - viewportPadding)
      const top = Math.max(viewportPadding, Math.min(preferredTop, maxTop))

      const nextStyle: CSSProperties = {
          left,
          top,
          width: dropdownWidth,
          maxHeight: MODEL_SELECTOR_DROPDOWN_MAX_HEIGHT,
      }

      setEmbeddedDropdownStyle((currentStyle) =>
          areEmbeddedDropdownStylesEqual(currentStyle, nextStyle) ? currentStyle : nextStyle
      )
  }, [dropdownAlign, dropdownContentRef, dropdownPlacement, dropdownRef, isEmbedded])

  const scheduleEmbeddedDropdownPosition = useCallback(() => {
      if (embeddedPositionFrameRef.current !== null) {
          return
      }

      embeddedPositionFrameRef.current = window.requestAnimationFrame(() => {
          embeddedPositionFrameRef.current = null
          updateEmbeddedDropdownPosition()
      })
  }, [updateEmbeddedDropdownPosition])

  useLayoutEffect(() => {
      if (!isOpen || !isEmbedded) {
          if (embeddedPositionFrameRef.current !== null) {
              window.cancelAnimationFrame(embeddedPositionFrameRef.current)
              embeddedPositionFrameRef.current = null
          }
          setEmbeddedDropdownStyle((currentStyle) => (currentStyle === null ? currentStyle : null))
          return
      }

      updateEmbeddedDropdownPosition()
      window.addEventListener('resize', scheduleEmbeddedDropdownPosition)
      window.addEventListener('scroll', scheduleEmbeddedDropdownPosition, true)
      return () => {
          window.removeEventListener('resize', scheduleEmbeddedDropdownPosition)
          window.removeEventListener('scroll', scheduleEmbeddedDropdownPosition, true)
          if (embeddedPositionFrameRef.current !== null) {
              window.cancelAnimationFrame(embeddedPositionFrameRef.current)
              embeddedPositionFrameRef.current = null
          }
      }
  }, [isEmbedded, isOpen, scheduleEmbeddedDropdownPosition, updateEmbeddedDropdownPosition])

  return embeddedDropdownStyle
}
