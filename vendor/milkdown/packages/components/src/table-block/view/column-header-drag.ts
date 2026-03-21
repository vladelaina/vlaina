import type { Ref } from 'vue'

import type { Ctx } from '@milkdown/ctx'
import { editorViewCtx } from '@milkdown/core'

import { onBeforeUnmount } from 'vue'

import type { ColumnMenuAction } from './column-header-drag-state'
import type { DragSession, PressSession } from './column-header-drag-types'
import { useColumnHeaderDragViewState } from './column-header-drag-view'
import {
  acquireTableDragCursor,
  releaseTableDragCursor,
  suppressTableDragSelection,
} from './drag-cursor'
import { getDragOverColumn } from '../dnd/calc-drag-over'

interface UseColumnHeaderDragOptions {
  ctx: Ctx
  tableWrapperRef: Ref<HTMLDivElement | undefined>
  contentWrapperRef: Ref<HTMLElement | undefined>
  tableScrollRef: Ref<HTMLDivElement | undefined>
  moveCol: (from: number, to: number) => void
  insertColLeft: (index: number) => void
  insertColRight: (index: number) => void
  clearColContent: (index: number) => void
  deleteCol: (index: number) => void
}

const DRAG_START_DISTANCE = 4

let menuIdSequence = 0

export function useColumnHeaderDrag({
  ctx,
  tableWrapperRef,
  contentWrapperRef,
  tableScrollRef,
  moveCol,
  insertColLeft,
  insertColRight,
  clearColContent,
  deleteCol,
}: UseColumnHeaderDragOptions) {
  const menuId = `column-header-drag-menu-${menuIdSequence += 1}`

  let pressSession: PressSession | null = null
  let dragSession: DragSession | null = null
  let suppressNextClick = false
  const canUseWindow = typeof window !== 'undefined'
  let pointerListenersBound = false
  let menuListenersBound = false

  const resetPressSession = () => {
    pressSession = null
    syncGlobalListeners()
  }

  const resetDragSession = () => {
    dragSession = null
    releaseTableDragCursor()
    syncGlobalListeners()
  }

  const bindPointerListeners = () => {
    if (!canUseWindow || pointerListenersBound) return
    window.addEventListener('pointermove', handleWindowPointerMove)
    window.addEventListener('pointerup', handleWindowPointerEnd)
    window.addEventListener('pointercancel', handleWindowPointerEnd)
    pointerListenersBound = true
  }

  const unbindPointerListeners = () => {
    if (!canUseWindow || !pointerListenersBound) return
    window.removeEventListener('pointermove', handleWindowPointerMove)
    window.removeEventListener('pointerup', handleWindowPointerEnd)
    window.removeEventListener('pointercancel', handleWindowPointerEnd)
    pointerListenersBound = false
  }

  const bindMenuListeners = () => {
    if (!canUseWindow || menuListenersBound) return
    window.addEventListener('pointerdown', handleWindowPointerDown, true)
    window.addEventListener('keydown', handleWindowKeyDown)
    menuListenersBound = true
  }

  const unbindMenuListeners = () => {
    if (!canUseWindow || !menuListenersBound) return
    window.removeEventListener('pointerdown', handleWindowPointerDown, true)
    window.removeEventListener('keydown', handleWindowKeyDown)
    menuListenersBound = false
  }

  const syncGlobalListeners = () => {
    if (pressSession || dragSession) {
      bindPointerListeners()
    } else {
      unbindPointerListeners()
    }

    if (menuState.value != null) {
      bindMenuListeners()
    } else {
      unbindMenuListeners()
    }
  }

  const {
    controls,
    activeColIndex,
    dragIndicator,
    dragSourceHighlight,
    menuState,
    rememberPointerPosition,
    rememberFocusedControl,
    clearHoverClearTimer,
    clearMenu,
    closeMenu,
    syncControls,
    syncHoveredControl,
    clearHoveredControl,
    syncHoverFromPointer,
    onControlFocus,
    onControlBlur,
    openMenu,
    resetViewState,
    setMenuRef,
    setControlRef,
    isFocusInsideMenu,
    moveMenuFocus,
  } = useColumnHeaderDragViewState({
    tableWrapperRef,
    contentWrapperRef,
    getPressSession: () => pressSession,
    getDragSession: () => dragSession,
    syncGlobalListeners,
  })

  const getTargetIndexFromPointer = (clientX: number) => {
    const content = contentWrapperRef.value
    if (!content) return null
    const result = getDragOverColumn(content, clientX)
    if (!result) return null
    return result[1]
  }

  const beginDrag = (session: PressSession) => {
    clearMenu()
    const nextTargetIndex = getTargetIndexFromPointer(session.currentX)
    dragSession = {
      pointerId: session.pointerId,
      from: session.index,
      to: nextTargetIndex ?? session.index,
      lastNonOriginTo:
        nextTargetIndex != null && nextTargetIndex !== session.index
          ? nextTargetIndex
          : null,
      currentX: session.currentX,
      currentY: session.currentY,
    }
    suppressNextClick = true
    activeColIndex.value = session.index
    acquireTableDragCursor('ew-resize')
    syncControls()
  }

  const maybeAutoScroll = (clientX: number) => {
    const scroll = tableScrollRef.value
    if (!scroll) return

    const rect = scroll.getBoundingClientRect()
    const edge = 72

    if (clientX < rect.left + edge) {
      scroll.scrollLeft -= Math.ceil((rect.left + edge - clientX) / 8)
    } else if (clientX > rect.right - edge) {
      scroll.scrollLeft += Math.ceil((clientX - (rect.right - edge)) / 8)
    }
  }

  const handleWindowPointerMove = (event: PointerEvent) => {
    rememberPointerPosition(event.clientX, event.clientY)

    if (pressSession && event.pointerId === pressSession.pointerId) {
      pressSession.currentX = event.clientX
      pressSession.currentY = event.clientY
      suppressTableDragSelection()
      const movedDistance = Math.hypot(
        pressSession.currentX - pressSession.startX,
        pressSession.currentY - pressSession.startY
      )
      if (movedDistance >= DRAG_START_DISTANCE) {
        const current = pressSession
        resetPressSession()
        beginDrag(current)
        return
      }
      syncControls()
      return
    }

    if (!dragSession || event.pointerId !== dragSession.pointerId) return

    dragSession.currentX = event.clientX
    dragSession.currentY = event.clientY
    suppressTableDragSelection()
    maybeAutoScroll(event.clientX)
    const targetIndex = getTargetIndexFromPointer(event.clientX)
    if (targetIndex != null && dragSession.to !== targetIndex) {
      dragSession.to = targetIndex
      if (targetIndex !== dragSession.from) {
        dragSession.lastNonOriginTo = targetIndex
      }
    }
    syncControls()
  }

  const finishDrag = () => {
    if (!dragSession) return
    const { from, to, lastNonOriginTo, currentX, currentY } = dragSession
    const effectiveTo =
      to === from && lastNonOriginTo != null ? lastNonOriginTo : to
    resetDragSession()
    if (from !== effectiveTo) {
      moveCol(from, effectiveTo)
    }
    activeColIndex.value = null
    syncHoverFromPointer(currentX, currentY)
    syncControls()
  }

  const handleWindowPointerEnd = (event: PointerEvent) => {
    rememberPointerPosition(event.clientX, event.clientY)

    if (pressSession && event.pointerId === pressSession.pointerId) {
      resetPressSession()
      activeColIndex.value = null
      syncHoverFromPointer(event.clientX, event.clientY)
      syncControls()
      return
    }

    if (dragSession && event.pointerId === dragSession.pointerId) {
      finishDrag()
    }
  }

  const handleWindowPointerDown = (event: PointerEvent) => {
    rememberPointerPosition(event.clientX, event.clientY)
    if (menuState.value == null) return
    const target = event.target
    if (
      target instanceof Element &&
      target.closest(
        '[data-role="col-header-drag-control"], [data-role="col-header-drag-menu"]'
      )
    ) {
      return
    }
    closeMenu()
  }

  const handleWindowKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Escape' || menuState.value == null) return
    closeMenu({
      restoreControlFocus: true,
    })
  }

  const onRootPointerDown = (event: PointerEvent) => {
    rememberPointerPosition(event.clientX, event.clientY)
    if (event.pointerType === 'mouse') return
    syncHoveredControl(event)
  }

  const onControlPointerDown = (index: number, event: PointerEvent) => {
    const view = ctx.get(editorViewCtx)
    if (event.button !== 0) return
    if (!view.editable) return

    if (suppressNextClick) {
      suppressNextClick = false
    }

    rememberPointerPosition(event.clientX, event.clientY)
    rememberFocusedControl(index)
    event.preventDefault()
    event.stopPropagation()
    view.focus()
    clearHoverClearTimer()
    clearMenu()

    activeColIndex.value = index
    pressSession = {
      pointerId: event.pointerId,
      index,
      startX: event.clientX,
      startY: event.clientY,
      currentX: event.clientX,
      currentY: event.clientY,
    }
    syncControls()
  }

  const onControlClick = (index: number, event: MouseEvent) => {
    if (suppressNextClick) {
      suppressNextClick = false
      event.preventDefault()
      event.stopPropagation()
      return
    }

    const view = ctx.get(editorViewCtx)
    if (!view.editable) return

    event.preventDefault()
    event.stopPropagation()
    openMenu(index)
  }

  const onControlKeyDown = (index: number, event: KeyboardEvent) => {
    const view = ctx.get(editorViewCtx)
    if (!view.editable) return

    if (
      event.key === 'Enter' ||
      event.key === ' ' ||
      event.key === 'Spacebar' ||
      event.key === 'ArrowDown'
    ) {
      event.preventDefault()
      event.stopPropagation()
      openMenu(index, 'keyboard')
      return
    }

    if (event.key === 'Escape' && menuState.value?.index === index) {
      event.preventDefault()
      event.stopPropagation()
      closeMenu({
        restoreControlFocus: true,
      })
    }
  }

  const onMenuPointerDown = (event: PointerEvent) => {
    event.preventDefault()
    event.stopPropagation()
  }

  const onMenuKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      closeMenu({
        restoreControlFocus: true,
      })
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      event.stopPropagation()
      moveMenuFocus(1)
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      event.stopPropagation()
      moveMenuFocus(-1)
      return
    }

    if (event.key === 'Home') {
      event.preventDefault()
      event.stopPropagation()
      moveMenuFocus('start')
      return
    }

    if (event.key === 'End') {
      event.preventDefault()
      event.stopPropagation()
      moveMenuFocus('end')
    }
  }

  const onMenuAction = (action: ColumnMenuAction) => {
    const index = menuState.value?.index
    if (index == null) return
    const shouldRestoreControlFocus = isFocusInsideMenu()

    switch (action) {
      case 'insert-col-left':
        insertColLeft(index)
        break
      case 'insert-col-right':
        insertColRight(index)
        break
      case 'clear-col-content':
        clearColContent(index)
        break
      case 'delete-col':
        deleteCol(index)
        break
    }

    closeMenu({
      restoreControlFocus: shouldRestoreControlFocus,
    })
  }

  onBeforeUnmount(() => {
    unbindPointerListeners()
    unbindMenuListeners()
    pressSession = null
    dragSession = null
    suppressNextClick = false
    releaseTableDragCursor()
    resetViewState()
  })

  return {
    controls,
    dragIndicator,
    dragSourceHighlight,
    menuId,
    menuState,
    syncControls,
    syncHoveredControl,
    clearHoveredControl,
    onRootPointerDown,
    onControlPointerDown,
    onControlClick,
    onControlKeyDown,
    onControlFocus,
    onControlBlur,
    onMenuPointerDown,
    onMenuKeyDown,
    onMenuAction,
    setMenuRef,
    setControlRef,
  }
}
