import type { Refs } from './types'
import {
  getTableDomColCount,
  getTableDomRowCount,
} from './table-dom-metrics'

const TOOLTIP_OFFSET_X = 12
const TOOLTIP_OFFSET_Y = 14

export interface TableSizeTooltip {
  element: HTMLDivElement
}

function getTableSizeLabel(refs: Refs): string | null {
  const rowCount = getTableDomRowCount(refs.contentWrapperRef.value)
  const colCount = getTableDomColCount(refs.contentWrapperRef.value)
  if (rowCount == null || colCount == null || rowCount <= 0 || colCount <= 0) {
    return null
  }

  return `${rowCount}x${colCount}`
}

export function updateTableSizeTooltip(
  tooltip: TableSizeTooltip | null,
  refs: Refs,
  clientX: number,
  clientY: number
) {
  if (!tooltip) return

  const label = getTableSizeLabel(refs)
  if (!label) {
    tooltip.element.hidden = true
    return
  }

  tooltip.element.hidden = false
  tooltip.element.textContent = label
  tooltip.element.style.left = `${clientX + TOOLTIP_OFFSET_X}px`
  tooltip.element.style.top = `${clientY + TOOLTIP_OFFSET_Y}px`
}

export function createTableSizeTooltip(
  refs: Refs,
  clientX: number,
  clientY: number
): TableSizeTooltip | null {
  const ownerDocument =
    refs.contentWrapperRef.value?.ownerDocument ??
    refs.rootRef?.value?.ownerDocument ??
    (typeof document !== 'undefined' ? document : null)
  if (!ownerDocument?.body) return null

  const element = ownerDocument.createElement('div')
  element.className = 'table-size-drag-tooltip'
  element.dataset.role = 'table-size-drag-tooltip'
  element.setAttribute('aria-hidden', 'true')
  ownerDocument.body.appendChild(element)

  const tooltip = { element }
  updateTableSizeTooltip(tooltip, refs, clientX, clientY)
  return tooltip
}

export function destroyTableSizeTooltip(tooltip: TableSizeTooltip | null) {
  tooltip?.element.remove()
}
