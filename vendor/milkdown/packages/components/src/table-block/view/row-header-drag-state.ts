export interface RowHeaderControl {
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

export interface RowDragIndicator {
  left: number
  top: number
  width: number
}

export interface RowHighlight {
  left: number
  top: number
  width: number
  height: number
}

export interface RowMenuState {
  index: number
  left: number
  top: number
}

export type RowMenuAction =
  | 'insert-row-above'
  | 'insert-row-below'
  | 'clear-row-content'
  | 'delete-row'

const HANDLE_WIDTH = 18
export const ROW_HANDLE_HEIGHT = 36
const ROW_HANDLE_GAP = 4
const ROW_HOVER_BLEED_LEFT = 28
const ROW_HOVER_BLEED_RIGHT = 4
const MENU_WIDTH = 196
const MENU_GAP = 8
const MENU_EDGE_PADDING = 8

export function areRowControlsEqual(
  previous: readonly RowHeaderControl[],
  next: readonly RowHeaderControl[]
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

export function areRowIndicatorsEqual(
  previous: RowDragIndicator | null,
  next: RowDragIndicator | null
) {
  if (previous === next) return true
  if (previous == null || next == null) return previous === next

  return (
    previous.left === next.left &&
    previous.top === next.top &&
    previous.width === next.width
  )
}

export function areRowHighlightsEqual(
  previous: RowHighlight | null,
  next: RowHighlight | null
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

export function areRowMenusEqual(
  previous: RowMenuState | null,
  next: RowMenuState | null
) {
  if (previous === next) return true
  if (previous == null || next == null) return previous === next

  return (
    previous.index === next.index &&
    previous.left === next.left &&
    previous.top === next.top
  )
}

function resolveRowBounds(row: HTMLTableRowElement) {
  const rect = row.getBoundingClientRect()
  const firstCell = row.children.item(0)
  const lastCell = row.children.item(row.children.length - 1)

  if (firstCell instanceof HTMLElement && lastCell instanceof HTMLElement) {
    const firstRect = firstCell.getBoundingClientRect()
    const lastRect = lastCell.getBoundingClientRect()
    return {
      left: firstRect.left,
      top: rect.top,
      width: lastRect.right - firstRect.left,
      height: rect.height,
    }
  }

  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
  }
}

export function resolveRowHit(
  rows: readonly HTMLTableRowElement[],
  clientX: number,
  clientY: number
) {
  for (let index = 0; index < rows.length; index += 1) {
    const bounds = resolveRowBounds(rows[index])
    if (clientY < bounds.top || clientY > bounds.top + bounds.height) continue
    if (clientX < bounds.left - ROW_HOVER_BLEED_LEFT) continue
    if (clientX > bounds.left + ROW_HOVER_BLEED_RIGHT) continue

    return {
      index,
      localY: clientY - bounds.top,
    }
  }

  return null
}

function resolveHandleLeft(rowLeft: number) {
  return rowLeft - HANDLE_WIDTH - ROW_HANDLE_GAP
}

function resolveHandleTop(rowTop: number, height: number) {
  return rowTop + height / 2 - ROW_HANDLE_HEIGHT / 2
}

export function buildRowHeaderControls({
  rows,
  wrapperRect,
  activeIndex,
  visibleIndex,
}: {
  rows: readonly HTMLTableRowElement[]
  wrapperRect: DOMRect
  activeIndex: number | null
  visibleIndex: number | null
}) {
  return rows.map((row, index) => {
    const bounds = resolveRowBounds(row)
    const left = bounds.left - wrapperRect.left
    const top = bounds.top - wrapperRect.top

    return {
      index,
      left,
      top,
      width: bounds.width,
      height: bounds.height,
      handleLeft: resolveHandleLeft(left),
      handleTop: resolveHandleTop(top, bounds.height),
      active: activeIndex === index,
      visible: visibleIndex === index,
    }
  })
}

export function resolveRowMenuFromControl(
  control: RowHeaderControl,
  wrapperWidth: number
): RowMenuState {
  const idealLeft = control.handleLeft + HANDLE_WIDTH + MENU_GAP
  const maxLeft = Math.max(
    MENU_EDGE_PADDING,
    wrapperWidth - MENU_WIDTH - MENU_EDGE_PADDING
  )
  const left = Math.min(Math.max(idealLeft, MENU_EDGE_PADDING), maxLeft)

  return {
    index: control.index,
    left,
    top: Math.max(MENU_EDGE_PADDING, control.handleTop),
  }
}

export function resolveRowDragIndicator({
  sourceIndex,
  targetIndex,
  controls,
  contentRect,
  wrapperRect,
}: {
  sourceIndex: number
  targetIndex: number
  controls: readonly RowHeaderControl[]
  contentRect: DOMRect
  wrapperRect: DOMRect
}): RowDragIndicator | null {
  const target = controls[targetIndex]
  if (!target) return null

  return {
    left: contentRect.left - wrapperRect.left,
    top: targetIndex > sourceIndex ? target.top + target.height : target.top,
    width: contentRect.width,
  }
}

export function resolveRowHighlight({
  sourceIndex,
  controls,
}: {
  sourceIndex: number
  controls: readonly RowHeaderControl[]
}): RowHighlight | null {
  const source = controls[sourceIndex]
  if (!source) return null

  return {
    left: source.left,
    top: source.top,
    width: source.width,
    height: source.height,
  }
}
