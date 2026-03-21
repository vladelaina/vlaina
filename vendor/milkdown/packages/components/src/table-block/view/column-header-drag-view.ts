import { ref, type Ref } from 'vue'

import { createColumnHeaderDragDomController } from './column-header-drag-dom'
import {
  areControlsEqual,
  areHighlightsEqual,
  areIndicatorsEqual,
  areMenusEqual,
  buildHeaderControls,
  resolveColumnHighlight,
  resolveDragIndicator,
  resolveHeaderHit,
  resolveMenuFromControl,
  type ColumnHeaderControl,
  type ColumnHighlight,
  type ColumnMenuState,
  type DragIndicator,
} from './column-header-drag-state'
import type {
  DragSession,
  HoverSession,
  PointerPosition,
  PressSession,
} from './column-header-drag-types'

const HOVER_CLEAR_DELAY = 140

type UseColumnHeaderDragViewStateOptions = {
  tableWrapperRef: Ref<HTMLDivElement | undefined>
  contentWrapperRef: Ref<HTMLElement | undefined>
  getPressSession: () => PressSession | null
  getDragSession: () => DragSession | null
  syncGlobalListeners: () => void
}

export function useColumnHeaderDragViewState({
  tableWrapperRef,
  contentWrapperRef,
  getPressSession,
  getDragSession,
  syncGlobalListeners,
}: UseColumnHeaderDragViewStateOptions) {
  const controls = ref<ColumnHeaderControl[]>([])
  const activeColIndex = ref<number | null>(null)
  const hoveredControl = ref<HoverSession | null>(null)
  const dragIndicator = ref<DragIndicator | null>(null)
  const dragSourceHighlight = ref<ColumnHighlight | null>(null)
  const menuState = ref<ColumnMenuState | null>(null)

  let hoverClearTimer: number | null = null
  let lastPointerPosition: PointerPosition | null = null
  let lastFocusedControlIndex: number | null = null
  const dom = createColumnHeaderDragDomController()

  const rememberPointerPosition = (clientX: number, clientY: number) => {
    lastPointerPosition = {
      clientX,
      clientY,
    }
  }

  const rememberFocusedControl = (index: number) => {
    lastFocusedControlIndex = index
  }

  const clearHoverClearTimer = () => {
    if (hoverClearTimer == null || typeof window === 'undefined') return
    window.clearTimeout(hoverClearTimer)
    hoverClearTimer = null
  }

  const getHeaderCells = () => {
    const content = contentWrapperRef.value
    const firstRow = content?.querySelector('tr')
    if (!(firstRow instanceof HTMLTableRowElement)) return []

    return Array.from(firstRow.children).filter(
      (cell): cell is HTMLTableCellElement =>
        cell instanceof HTMLTableCellElement
    )
  }

  const syncControls = () => {
    const wrapper = tableWrapperRef.value
    const content = contentWrapperRef.value
    if (!wrapper || !content) {
      if (controls.value.length > 0) controls.value = []
      if (dragIndicator.value != null) dragIndicator.value = null
      if (dragSourceHighlight.value != null) dragSourceHighlight.value = null
      if (menuState.value != null) menuState.value = null
      syncGlobalListeners()
      return
    }

    const cells = getHeaderCells()
    if (cells.length === 0) {
      if (controls.value.length > 0) controls.value = []
      if (dragIndicator.value != null) dragIndicator.value = null
      if (dragSourceHighlight.value != null) dragSourceHighlight.value = null
      if (menuState.value != null) menuState.value = null
      syncGlobalListeners()
      return
    }

    const pressSession = getPressSession()
    const dragSession = getDragSession()
    const wrapperRect = wrapper.getBoundingClientRect()
    const visibleIndex =
      menuState.value?.index ??
      dragSession?.from ??
      pressSession?.index ??
      hoveredControl.value?.index

    const nextControls = buildHeaderControls({
      cells,
      wrapperRect,
      activeIndex: activeColIndex.value,
      visibleIndex: visibleIndex ?? null,
    })

    if (!areControlsEqual(controls.value, nextControls)) {
      controls.value = nextControls
    }

    if (menuState.value != null) {
      const menuControl = nextControls.find(
        (control) => control.index === menuState.value?.index
      )
      const nextMenu = menuControl
        ? resolveMenuFromControl(menuControl, wrapperRect.width)
        : null
      if (!areMenusEqual(menuState.value, nextMenu)) {
        menuState.value = nextMenu
      }
    }

    if (dragSession) {
      const target = nextControls[dragSession.to]
      const source = nextControls[dragSession.from]
      const contentRect = content.getBoundingClientRect()
      const nextIndicator =
        target == null
          ? null
          : resolveDragIndicator({
              sourceIndex: dragSession.from,
              targetIndex: dragSession.to,
              controls: nextControls,
              contentRect,
              wrapperRect,
            })
      if (!areIndicatorsEqual(dragIndicator.value, nextIndicator)) {
        dragIndicator.value = nextIndicator
      }

      const nextHighlight =
        source == null
          ? null
          : resolveColumnHighlight({
              sourceIndex: dragSession.from,
              controls: nextControls,
              contentRect,
              wrapperRect,
            })
      if (!areHighlightsEqual(dragSourceHighlight.value, nextHighlight)) {
        dragSourceHighlight.value = nextHighlight
      }
    } else {
      if (dragIndicator.value != null) dragIndicator.value = null
      if (dragSourceHighlight.value != null) dragSourceHighlight.value = null
    }

    syncGlobalListeners()
  }

  const setHoveredControl = (nextHover: HoverSession | null) => {
    const current = hoveredControl.value
    if (
      current?.index === nextHover?.index &&
      current?.localY === nextHover?.localY
    ) {
      return
    }

    hoveredControl.value = nextHover
    syncControls()
  }

  const scheduleHoverClear = () => {
    if (getDragSession() || getPressSession() || menuState.value != null) return
    if (hoveredControl.value == null || typeof window === 'undefined') return

    clearHoverClearTimer()
    hoverClearTimer = window.setTimeout(() => {
      hoverClearTimer = null
      setHoveredControl(null)
    }, HOVER_CLEAR_DELAY)
  }

  const syncHoverFromPointer = (clientX: number, clientY: number) => {
    rememberPointerPosition(clientX, clientY)
    if (menuState.value != null) return

    const hit = resolveHeaderHit(getHeaderCells(), clientX, clientY)
    if (!hit) {
      scheduleHoverClear()
      return
    }

    clearHoverClearTimer()
    setHoveredControl({
      index: hit.index,
      localY: hit.localY,
    })
  }

  const syncHoverFromLastPointer = () => {
    if (lastPointerPosition) {
      syncHoverFromPointer(
        lastPointerPosition.clientX,
        lastPointerPosition.clientY
      )
      return
    }

    scheduleHoverClear()
    syncControls()
  }

  const clearMenu = () => {
    if (menuState.value == null) return
    menuState.value = null
    dom.queueMenuFocus(false)
    dom.setMenuRef(null)
    if (!getDragSession() && !getPressSession()) {
      activeColIndex.value = null
    }
    syncGlobalListeners()
  }

  const closeMenu = ({
    restoreHover = true,
    restoreControlFocus = false,
  }: {
    restoreHover?: boolean
    restoreControlFocus?: boolean
  } = {}) => {
    const controlIndex = menuState.value?.index ?? lastFocusedControlIndex
    clearMenu()

    if (restoreControlFocus && controlIndex != null) {
      clearHoverClearTimer()
      setHoveredControl({
        index: controlIndex,
        localY: 0,
      })
      dom.focusControlElement(controlIndex)
      return
    }

    if (restoreHover) {
      syncHoverFromLastPointer()
      return
    }

    syncControls()
  }

  const syncHoveredControl = (event: PointerEvent) => {
    if (getDragSession() || getPressSession() || menuState.value != null) return
    syncHoverFromPointer(event.clientX, event.clientY)
  }

  const clearHoveredControl = () => {
    if (getDragSession() || getPressSession() || menuState.value != null) return
    scheduleHoverClear()
  }

  const onControlFocus = (index: number) => {
    lastFocusedControlIndex = index
    clearHoverClearTimer()
    if (getDragSession() || getPressSession()) return
    setHoveredControl({
      index,
      localY: 0,
    })
  }

  const onControlBlur = () => {
    if (getDragSession() || getPressSession() || menuState.value != null) return
    scheduleHoverClear()
  }

  const openMenu = (index: number, source: 'pointer' | 'keyboard' = 'pointer') => {
    const wrapper = tableWrapperRef.value
    const control = controls.value.find((item) => item.index === index)
    if (!wrapper || !control) return

    const wrapperRect = wrapper.getBoundingClientRect()
    const nextMenu = resolveMenuFromControl(control, wrapperRect.width)
    if (menuState.value?.index === index) {
      closeMenu({
        restoreControlFocus: source === 'keyboard',
      })
      return
    }

    clearHoverClearTimer()
    lastFocusedControlIndex = index
    activeColIndex.value = index
    menuState.value = nextMenu
    dom.queueMenuFocus(source === 'keyboard')
    syncControls()
  }

  const resetViewState = () => {
    clearHoverClearTimer()
    activeColIndex.value = null
    hoveredControl.value = null
    dragIndicator.value = null
    dragSourceHighlight.value = null
    menuState.value = null
    lastPointerPosition = null
    lastFocusedControlIndex = null
    dom.clear()
    syncGlobalListeners()
  }

  return {
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
    setMenuRef: dom.setMenuRef,
    setControlRef: dom.setControlRef,
    isFocusInsideMenu: dom.isFocusInsideMenu,
    moveMenuFocus: dom.moveMenuFocus,
  }
}
