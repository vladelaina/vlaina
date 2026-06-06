export const MAX_TABLE_DOM_METRIC_SCAN_ELEMENTS = 2048

function countCollection(collection: HTMLCollection): number | null {
  for (let index = 0; index < MAX_TABLE_DOM_METRIC_SCAN_ELEMENTS; index += 1) {
    if (!collection.item(index)) return index
  }

  return collection.item(MAX_TABLE_DOM_METRIC_SCAN_ELEMENTS) ? null : MAX_TABLE_DOM_METRIC_SCAN_ELEMENTS
}

export function getTableDomRowCount(content: HTMLElement | undefined): number | null {
  if (!content) return 0
  return countCollection(content.getElementsByTagName('tr'))
}

export function getTableDomColCount(content: HTMLElement | undefined): number | null {
  if (!content) return 0
  const firstRow = content.getElementsByTagName('tr').item(0)
  return firstRow ? countCollection(firstRow.children) : 0
}

export function getTableDomFirstRow(content: HTMLElement | undefined): HTMLTableRowElement | null {
  if (!content) return null
  const firstRow = content.getElementsByTagName('tr').item(0)
  const TableRowElement = content.ownerDocument.defaultView?.HTMLTableRowElement
  return TableRowElement && firstRow instanceof TableRowElement ? firstRow : null
}

export function getTableDomHeaderCells(content: HTMLElement | undefined): HTMLTableCellElement[] {
  const firstRow = getTableDomFirstRow(content)
  if (!firstRow) return []

  const TableCellElement = content?.ownerDocument.defaultView?.HTMLTableCellElement
  if (!TableCellElement) return []

  const cells: HTMLTableCellElement[] = []
  const scanLength = Math.min(firstRow.children.length, MAX_TABLE_DOM_METRIC_SCAN_ELEMENTS)
  for (let index = 0; index < scanLength; index += 1) {
    const cell = firstRow.children.item(index)
    if (cell instanceof TableCellElement) cells.push(cell)
  }
  return firstRow.children.item(MAX_TABLE_DOM_METRIC_SCAN_ELEMENTS) ? [] : cells
}
