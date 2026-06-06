import { describe, expect, it, vi } from 'vitest'

import {
  createColumnHeaderDragDomController,
  MAX_COLUMN_HEADER_MENU_ITEM_SCAN_ELEMENTS,
} from './column-header-drag-dom'

function createMenu(itemCount: number) {
  const menu = document.createElement('div')
  for (let index = 0; index < itemCount; index += 1) {
    const item = document.createElement('button')
    item.dataset.role = 'col-header-drag-menu-item'
    item.textContent = `Item ${index}`
    menu.appendChild(item)
  }
  document.body.appendChild(menu)
  return menu
}

describe('column header drag DOM controller', () => {
  it('moves menu focus without materializing menu item query results', () => {
    const controller = createColumnHeaderDragDomController()
    const menu = createMenu(3)
    const items = Array.from(menu.children) as HTMLButtonElement[]
    controller.setMenuRef(menu)
    items[0]?.focus()

    const querySelectorAllSpy = vi.spyOn(menu, 'querySelectorAll')
    const arrayFromSpy = vi.spyOn(Array, 'from').mockImplementation(() => {
      throw new Error('Array.from should not be used')
    })

    try {
      controller.moveMenuFocus('end')
      expect(document.activeElement).toBe(items[2])

      controller.moveMenuFocus(1)
      expect(document.activeElement).toBe(items[0])
      expect(querySelectorAllSpy).not.toHaveBeenCalled()
    } finally {
      arrayFromSpy.mockRestore()
      querySelectorAllSpy.mockRestore()
      menu.remove()
    }
  })

  it('caps menu focus scans', () => {
    const controller = createColumnHeaderDragDomController()
    const menu = document.createElement('div')
    const outsideButton = document.createElement('button')
    document.body.append(outsideButton, menu)
    for (let index = 0; index < MAX_COLUMN_HEADER_MENU_ITEM_SCAN_ELEMENTS + 1; index += 1) {
      const wrapper = document.createElement('span')
      menu.appendChild(wrapper)
    }
    const lateItem = document.createElement('button')
    lateItem.dataset.role = 'col-header-drag-menu-item'
    menu.appendChild(lateItem)
    controller.setMenuRef(menu)
    outsideButton.focus()

    controller.moveMenuFocus('end')

    expect(document.activeElement).toBe(outsideButton)
    menu.remove()
    outsideButton.remove()
  })
})
