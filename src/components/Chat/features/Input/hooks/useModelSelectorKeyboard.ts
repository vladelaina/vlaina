import { useEffect, type Dispatch, type SetStateAction } from 'react'
import type { AIModel } from '@/lib/ai/types'

interface UseModelSelectorKeyboardParams {
  isOpen: boolean
  filteredModels: AIModel[]
  focusedModelId: string | null
  setFocusedModelId: Dispatch<SetStateAction<string | null>>
  setKeyboardNavigating: (value: boolean) => void
  onShortcutToggle: () => void
  onClose: () => void
  onSelectModel: (modelId: string) => void
  requestNearestScroll: () => void
  clearScrollMode: () => void
}

export function useModelSelectorKeyboard({
  isOpen,
  filteredModels,
  focusedModelId,
  setFocusedModelId,
  setKeyboardNavigating,
  onShortcutToggle,
  onClose,
  onSelectModel,
  requestNearestScroll,
  clearScrollMode,
}: UseModelSelectorKeyboardParams) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.isComposing) {
        return
      }

      const isMod = e.metaKey || e.ctrlKey
      if (isMod && e.key.toLowerCase() === 'm') {
        e.preventDefault()
        onShortcutToggle()
        return
      }

      if (!isOpen) return

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        if (filteredModels.length === 0) {
          clearScrollMode()
          setFocusedModelId(null)
          return
        }
        setKeyboardNavigating(true)
        requestNearestScroll()
        setFocusedModelId((current) => {
          const currentIndex = filteredModels.findIndex((model) => model.id === current)
          const nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % filteredModels.length
          return filteredModels[nextIndex]?.id ?? current
        })
        return
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault()
        if (filteredModels.length === 0) {
          clearScrollMode()
          setFocusedModelId(null)
          return
        }
        setKeyboardNavigating(true)
        requestNearestScroll()
        setFocusedModelId((current) => {
          const currentIndex = filteredModels.findIndex((model) => model.id === current)
          const prevIndex = currentIndex === -1
            ? filteredModels.length - 1
            : (currentIndex - 1 + filteredModels.length) % filteredModels.length
          return filteredModels[prevIndex]?.id ?? current
        })
        return
      }

      if (e.key === 'Enter') {
        e.preventDefault()
        const hasVisibleFocusedModel = !!focusedModelId && filteredModels.some((model) => model.id === focusedModelId)
        if (hasVisibleFocusedModel && focusedModelId) {
          onSelectModel(focusedModelId)
        } else if (filteredModels.length > 0) {
          onSelectModel(filteredModels[0].id)
        }
        return
      }

      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    clearScrollMode,
    filteredModels,
    focusedModelId,
    isOpen,
    onClose,
    onSelectModel,
    onShortcutToggle,
    requestNearestScroll,
    setFocusedModelId,
    setKeyboardNavigating,
  ])
}
