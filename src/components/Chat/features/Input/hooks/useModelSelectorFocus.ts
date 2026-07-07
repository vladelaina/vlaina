import { useCallback, useEffect, useRef, type RefObject } from 'react'
import {
  focusComposerInput as focusRegisteredComposerInput,
  focusVisibleTextareaAt,
} from '@/lib/ui/composerFocusRegistry'

export function useModelSelectorFocus(
  composerInputRef?: RefObject<HTMLInputElement | HTMLTextAreaElement | null>
) {
  const inputRef = useRef<HTMLInputElement>(null)
  const focusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const focusSearchInput = useCallback(() => {
      if (focusTimerRef.current !== null) {
          clearTimeout(focusTimerRef.current)
      }
      focusTimerRef.current = setTimeout(() => {
          focusTimerRef.current = null
          inputRef.current?.focus({ preventScroll: true })
      }, 90)
  }, [])

  const focusComposerInput = useCallback(() => {
      if (focusTimerRef.current !== null) {
          clearTimeout(focusTimerRef.current)
      }
      focusTimerRef.current = setTimeout(() => {
          focusTimerRef.current = null
          const input = composerInputRef?.current
          if (input instanceof HTMLTextAreaElement && focusVisibleTextareaAt(input)) {
              return
          }
          focusRegisteredComposerInput()
      }, 50)
  }, [composerInputRef])

  useEffect(() => {
      return () => {
          if (focusTimerRef.current !== null) {
              clearTimeout(focusTimerRef.current)
              focusTimerRef.current = null
          }
      }
  }, [])

  return {
    inputRef,
    focusSearchInput,
    focusComposerInput,
  }
}
