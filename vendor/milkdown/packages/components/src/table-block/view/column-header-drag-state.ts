export interface ColumnHeaderControl {
  index: number
  left: number
  top: number
  width: number
  height: number
  handleLeft: number
  handleTop: number
  active: boolean
  visible: boolean
}

export interface DragIndicator {
  left: number
  top: number
  height: number
}

export interface ColumnHighlight {
  left: number
  top: number
  width: number
  height: number
}

export interface ColumnMenuState {
  index: number
  left: number
  top: number
}

export type ColumnMenuAction =
  | 'insert-col-left'
  | 'insert-col-right'
  | 'clear-col-content'
  | 'delete-col'

const HANDLE_WIDTH = 36
export const HANDLE_HEIGHT = 18
const HEADER_HOVER_BLEED_TOP = 12
const HEADER_HOVER_BAND_HEIGHT = 20
const MENU_WIDTH = 196
const MENU_GAP = 8
const MENU_EDGE_PADDING = 8

export function areControlsEqual(
  previous: readonly ColumnHeaderControl[],
  next: readonly ColumnHeaderControl[]
) {
  if (previous.length !== next.length) return false

  return previous.every((control, index) => {
    const nextControl = next[index]
    return (
      control.index === nextControl.index &&
      control.left === nextControl.left &&
      control.top === nextControl.top &&
      control.width === nextControl.width &&
      control.height === nextControl.height &&
      control.handleLeft === nextControl.handleLeft &&
      control.handleTop === nextControl.handleTop &&
      control.active === nextControl.active &&
      control.visible === nextControl.visible
    )
  })
}

export function areIndicatorsEqual(
  previous: DragIndicator | null,
  next: DragIndicator | null
) {
  if (previous === next) return true
  if (previous == null || next == null) return previous === next

  return (
    previous.left === next.left &&
    previous.top === next.top &&
    previous.height === next.height
  )
}

export function areHighlightsEqual(
  previous: ColumnHighlight | null,
  next: ColumnHighlight | null
) {
  if (previous === next) return true
  if (previous == null || next == null) return previous === next

  return (
    previous.left === next.left &&
    previous.top === next.top &&
    previous.width === next.width &&
    previous.height === next.height
  )
}

export function areMenusEqual(
  previous: ColumnMenuState | null,
  next: ColumnMenuState | null
) {
  if (previous === next) return true
  if (previous == null || next == null) return previous === next

  return (
    previous.index === next.index &&
    previous.left === next.left &&
    previous.top === next.top
  )
}

export function resolveHeaderHit(
  cells: readonly HTMLTableCellElement[],
  clientX: number,
  clientY: number
) {
  for (let index = 0; index < cells.length; index += 1) {
    const rect = cells[index].getBoundingClientRect()
    if (clientX < rect.left || clientX > rect.right) continue
    if (clientY < rect.top - HEADER_HOVER_BLEED_TOP) continue
    if (clientY > rect.top + HEADER_HOVER_BAND_HEIGHT) continue

    return {
      index,
      localY: clientY - rect.top,
    }
  }

  return null
}

function resolveHandleLeft(cellLeft: number, width: number) {
  return cellLeft + width / 2 - HANDLE_WIDTH / 2
}

export function buildHeaderControls({
  cells,
  wrapperRect,
  activeIndex,
  visibleIndex,
}: {
  cells: readonly HTMLTableCellElement[]
  wrapperRect: DOMRect
  activeIndex: number | null
  visibleIndex: number | null
}) {
  return cells.map((cell, index) => {
    const rect = cell.getBoundingClientRect()
    return {
      index,
      left: rect.left - wrapperRect.left,
      top: rect.top - wrapperRect.top,
      width: rect.width,
      height: rect.height,
      handleLeft: resolveHandleLeft(rect.left - wrapperRect.left, rect.width),
      handleTop: rect.top - wrapperRect.top - HANDLE_HEIGHT / 2,
      active: activeIndex === index,
      visible: visibleIndex === index,
    }
  })
}

export function resolveMenuFromControl(
  control: ColumnHeaderControl,
  wrapperWidth: number
): ColumnMenuState {
  const idealLeft = control.handleLeft + HANDLE_WIDTH / 2 - MENU_WIDTH / 2
  const maxLeft = Math.max(
    MENU_EDGE_PADDING,
    wrapperWidth - MENU_WIDTH - MENU_EDGE_PADDING
  )
  const left = Math.min(Math.max(idealLeft, MENU_EDGE_PADDING), maxLeft)

  return {
    index: control.index,
    left,
    top: control.handleTop + HANDLE_HEIGHT + MENU_GAP,
  }
}

export function resolveDragIndicator({
  sourceIndex,
  targetIndex,
  controls,
  contentRect,
  wrapperRect,
}: {
  sourceIndex: number
  targetIndex: number
  controls: readonly ColumnHeaderControl[]
  contentRect: DOMRect
  wrapperRect: DOMRect
}): DragIndicator | null {
  const target = controls[targetIndex]
  if (!target) return null

  return {
    left:
      targetIndex > sourceIndex ? target.left + target.width : target.left,
    top: contentRect.top - wrapperRect.top,
    height: contentRect.height,
  }
}

export function resolveColumnHighlight({
  sourceIndex,
  controls,
  contentRect,
  wrapperRect,
}: {
  sourceIndex: number
  controls: readonly ColumnHeaderControl[]
  contentRect: DOMRect
  wrapperRect: DOMRect
}): ColumnHighlight | null {
  const source = controls[sourceIndex]
  if (!source) return null

  return {
    left: source.left,
    top: contentRect.top - wrapperRect.top,
    width: source.width,
    height: contentRect.height,
  }
}
