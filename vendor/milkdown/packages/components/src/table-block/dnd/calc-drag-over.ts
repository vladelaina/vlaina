export const MAX_TABLE_DRAG_OVER_SCAN_ELEMENTS = 2048

function findDragOverElement(
  elements: HTMLCollection,
  pointer: number,
  axis: 'x' | 'y'
): [Element, number] | undefined {
  const startProp = axis === 'x' ? 'left' : 'top'
  const endProp = axis === 'x' ? 'right' : 'bottom'
  const scanLength = Math.min(elements.length, MAX_TABLE_DRAG_OVER_SCAN_ELEMENTS)
  let lastElement: Element | undefined
  let lastIndex = -1
  let lastBoundaryEnd = 0

  for (let index = 0; index < scanLength; index += 1) {
    const el = elements.item(index)
    if (!el) continue
    const rect = el.getBoundingClientRect()
    const boundaryStart = rect[startProp]
    const boundaryEnd = rect[endProp]
    lastElement = el
    lastIndex = index
    lastBoundaryEnd = boundaryEnd

    // The pointer is within the boundary of the current element.
    if (boundaryStart <= pointer && pointer <= boundaryEnd) return [el, index]
    // The pointer is before the first element.
    if (index === 0 && pointer < boundaryStart) return [el, index]
  }

  // The pointer is beyond the last element.
  if (scanLength === elements.length && lastElement && pointer > lastBoundaryEnd)
    return [lastElement, lastIndex]
}

export function getDragOverColumn(
  table: Element,
  pointerX: number
): [element: Element, index: number] | undefined {
  const firstRow = table.getElementsByTagName('tr').item(0)
  if (!firstRow) return
  return findDragOverElement(firstRow.children, pointerX, 'x')
}

export function getDragOverRow(
  table: Element,
  pointerY: number
): [element: Element, index: number] | undefined {
  return findDragOverElement(table.getElementsByTagName('tr'), pointerY, 'y')
}
