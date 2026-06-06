import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  acquireTableDragCursor,
  MAX_TABLE_DRAG_CURSOR_HIDDEN_EDITORS,
  releaseTableDragCursor,
} from './drag-cursor'

function countHiddenSelectionEditors() {
  let count = 0
  const walker = document.createTreeWalker(document.body, 1)
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (
      node instanceof HTMLElement &&
      node.classList.contains('ProseMirror-hideselection')
    ) {
      count += 1
    }
  }
  return count
}

afterEach(() => {
  releaseTableDragCursor()
  document.body.innerHTML = ''
  document.documentElement.removeAttribute('data-table-resize-cursor')
  document.documentElement.removeAttribute('data-table-resize-selection-lock')
  document.documentElement.removeAttribute('data-table-resize-toolbar-suppress')
  document.body.removeAttribute('data-table-resize-cursor')
  document.body.removeAttribute('data-table-resize-selection-lock')
  document.body.removeAttribute('data-table-resize-toolbar-suppress')
})

describe('table drag cursor', () => {
  it('hides editor selections without materializing global query results', () => {
    for (let index = 0; index < MAX_TABLE_DRAG_CURSOR_HIDDEN_EDITORS + 2; index += 1) {
      const milkdown = document.createElement('div')
      milkdown.className = 'milkdown'
      const editor = document.createElement('div')
      editor.className = 'ProseMirror'
      milkdown.appendChild(editor)
      document.body.appendChild(milkdown)
    }
    const querySelectorAllSpy = vi.spyOn(document, 'querySelectorAll')
    const arrayFromSpy = vi.spyOn(Array, 'from').mockImplementation(() => {
      throw new Error('Array.from should not be used')
    })

    try {
      acquireTableDragCursor('col-resize')

      expect(countHiddenSelectionEditors()).toBe(MAX_TABLE_DRAG_CURSOR_HIDDEN_EDITORS)
      expect(querySelectorAllSpy).not.toHaveBeenCalled()
    } finally {
      arrayFromSpy.mockRestore()
      querySelectorAllSpy.mockRestore()
      releaseTableDragCursor()
    }

    expect(countHiddenSelectionEditors()).toBe(0)
  })
})
