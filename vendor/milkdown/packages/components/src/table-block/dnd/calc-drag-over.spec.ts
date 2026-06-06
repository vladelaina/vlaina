import { describe, expect, it, vi } from 'vitest'

import {
  getDragOverColumn,
  getDragOverRow,
  MAX_TABLE_DRAG_OVER_SCAN_ELEMENTS,
} from './calc-drag-over'

function rectForIndex(index: number, axis: 'x' | 'y'): DOMRect {
  const start = index * 10
  const rect = {
    left: axis === 'x' ? start : 0,
    right: axis === 'x' ? start + 10 : 10,
    top: axis === 'y' ? start : 0,
    bottom: axis === 'y' ? start + 10 : 10,
    width: 10,
    height: 10,
    x: axis === 'x' ? start : 0,
    y: axis === 'y' ? start : 0,
    toJSON: () => ({}),
  }
  return rect as DOMRect
}

function createTable(rowCount: number, colCount: number) {
  const table = document.createElement('table')
  const tbody = document.createElement('tbody')
  table.appendChild(tbody)

  for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
    const row = document.createElement('tr')
    row.dataset.rowIndex = String(rowIndex)
    row.getBoundingClientRect = vi.fn(() => rectForIndex(rowIndex, 'y'))

    for (let colIndex = 0; colIndex < colCount; colIndex += 1) {
      const cell = document.createElement('td')
      cell.dataset.colIndex = String(colIndex)
      cell.getBoundingClientRect = vi.fn(() => rectForIndex(colIndex, 'x'))
      row.appendChild(cell)
    }

    tbody.appendChild(row)
  }

  return table
}

describe('table drag over calculation', () => {
  it('finds drag over rows and columns without materializing DOM collections', () => {
    const table = createTable(3, 3)
    const querySelectorAllSpy = vi.spyOn(table, 'querySelectorAll')
    const arrayFromSpy = vi.spyOn(Array, 'from').mockImplementation(() => {
      throw new Error('Array.from should not be used')
    })

    try {
      const row = getDragOverRow(table, 15)
      const col = getDragOverColumn(table, 25)

      expect(row?.[0]).toBe(table.getElementsByTagName('tr').item(1))
      expect(row?.[1]).toBe(1)
      expect(col?.[0]).toBe(table.getElementsByTagName('td').item(2))
      expect(col?.[1]).toBe(2)
      expect(querySelectorAllSpy).not.toHaveBeenCalled()
    } finally {
      arrayFromSpy.mockRestore()
      querySelectorAllSpy.mockRestore()
    }
  })

  it('does not guess a drag over row after the scan budget is exhausted', () => {
    const table = createTable(MAX_TABLE_DRAG_OVER_SCAN_ELEMENTS + 1, 1)

    expect(getDragOverRow(table, 999999)).toBeUndefined()
  })
})
