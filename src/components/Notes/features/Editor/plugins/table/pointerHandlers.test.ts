import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { usePointerHandlers } from '../../../../../../../vendor/milkdown/packages/components/src/table-block/view/pointer'

function setRect(
  element: Element,
  rect: {
    left: number
    top: number
    width: number
    height: number
  }
) {
  Object.defineProperty(element, 'getBoundingClientRect', {
    configurable: true,
    value: () =>
      ({
        x: rect.left,
        y: rect.top,
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
        right: rect.left + rect.width,
        bottom: rect.top + rect.height,
        toJSON: () => rect,
      }) as DOMRect,
  })
}

function createPointerEvent({
  clientX,
  clientY,
}: {
  clientX: number
  clientY: number
}) {
  return {
    clientX,
    clientY,
  } as PointerEvent
}

describe('pointer handlers', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('cancels delayed edge-handle hiding when the pointer re-enters quickly', () => {
    const wrapper = document.createElement('div')
    const content = document.createElement('table')
    const row = document.createElement('tr')
    row.appendChild(document.createElement('td'))
    row.appendChild(document.createElement('td'))
    content.appendChild(row)
    content.appendChild(document.createElement('tr'))

    const xHandle = document.createElement('div')
    const yHandle = document.createElement('div')
    xHandle.dataset.show = 'false'
    yHandle.dataset.show = 'false'

    setRect(wrapper, {
      left: 40,
      top: 60,
      width: 280,
      height: 160,
    })
    setRect(content, {
      left: 80,
      top: 90,
      width: 240,
      height: 120,
    })

    const refs = {
      tableWrapperRef: { value: wrapper },
      contentWrapperRef: { value: content },
      yLineHandleRef: { value: yHandle },
      xLineHandleRef: { value: xHandle },
      lineHoverIndex: { value: [-1, -1] as [number, number] },
    } as never

    const { pointerMove, pointerLeave } = usePointerHandlers(refs, {
      editable: true,
    } as never)

    pointerMove(
      createPointerEvent({
        clientX: 319,
        clientY: 120,
      })
    )
    vi.advanceTimersByTime(20)
    expect(yHandle.dataset.show).toBe('true')

    pointerLeave()
    vi.advanceTimersByTime(100)

    pointerMove(
      createPointerEvent({
        clientX: 319,
        clientY: 120,
      })
    )
    vi.advanceTimersByTime(20)
    vi.advanceTimersByTime(200)

    expect(yHandle.dataset.show).toBe('true')
  })
})
