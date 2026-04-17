import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useEffect, useRef, useState } from 'react'
import { useModelSelectorScroll } from './useModelSelectorScroll'

function ScrollHarness() {
  const [focusedIndex, setFocusedIndex] = useState(-1)
  const listRef = useRef<HTMLDivElement>(null)

  const { requestCenterScroll, requestNearestScroll, clearScrollMode } = useModelSelectorScroll({
    isOpen: true,
    focusedIndex,
    scrollToIndex: (index, align) => {
      const list = listRef.current
      if (!list) {
        return
      }

      const itemTop = index * 40
      const itemBottom = itemTop + 40

      if (align === 'center') {
        list.scrollTop = itemTop - (list.clientHeight / 2) + 20
        return
      }

      const viewTop = list.scrollTop
      const viewBottom = viewTop + list.clientHeight
      if (itemTop < viewTop) {
        list.scrollTop = itemTop
      } else if (itemBottom > viewBottom) {
        list.scrollTop = itemBottom - list.clientHeight
      }
    },
  })

  useEffect(() => {
    const list = listRef.current
    if (!list) {
      return
    }

    Object.defineProperty(list, 'clientHeight', { value: 200, configurable: true })
    Object.defineProperty(list, 'scrollHeight', { value: 1000, configurable: true })
    Object.defineProperty(list, 'scrollTop', { value: 0, writable: true, configurable: true })

    const items = Array.from(list.querySelectorAll('[data-model-id]'))
    items.forEach((item, index) => {
      Object.defineProperty(item, 'offsetTop', { value: index * 40, configurable: true })
      Object.defineProperty(item, 'offsetHeight', { value: 40, configurable: true })
    })
  }, [])

  return (
    <div>
      <button
        data-testid="center"
        onClick={() => {
          requestCenterScroll()
          setFocusedIndex(4)
        }}
      >
        center
      </button>
      <button
        data-testid="nearest-down"
        onClick={() => {
          requestNearestScroll()
          setFocusedIndex(7)
        }}
      >
        nearest-down
      </button>
      <button
        data-testid="none"
        onClick={() => {
          clearScrollMode()
          setFocusedIndex(1)
        }}
      >
        none
      </button>

      <div ref={listRef} data-testid="list">
        {Array.from({ length: 10 }, (_, index) => (
          <div key={index} data-model-id={`model-${index + 1}`}>
            model-{index + 1}
          </div>
        ))}
      </div>
    </div>
  )
}

describe('useModelSelectorScroll', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('centers the focused item when center mode is requested', () => {
    render(<ScrollHarness />)
    const list = screen.getByTestId('list')

    fireEvent.click(screen.getByTestId('center'))

    expect(list.scrollTop).toBe(80)
  })

  it('uses nearest mode for keyboard-like navigation', () => {
    render(<ScrollHarness />)
    const list = screen.getByTestId('list')
    list.scrollTop = 0

    fireEvent.click(screen.getByTestId('nearest-down'))

    expect(list.scrollTop).toBe(120)
  })

  it('does not scroll when scroll mode is cleared (hover scenario)', () => {
    render(<ScrollHarness />)
    const list = screen.getByTestId('list')

    fireEvent.click(screen.getByTestId('nearest-down'))
    expect(list.scrollTop).toBe(120)

    fireEvent.click(screen.getByTestId('none'))
    expect(list.scrollTop).toBe(120)
  })
})
