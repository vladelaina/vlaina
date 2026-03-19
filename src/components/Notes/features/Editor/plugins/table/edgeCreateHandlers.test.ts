import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('vue', () => ({
  onMounted: () => {},
  onUnmounted: () => {},
}))

vi.mock('../../../../../../../vendor/milkdown/packages/components/src/table-block/view/drag-cursor', () => ({
  acquireTableDragCursor: vi.fn(),
  releaseTableDragCursor: vi.fn(),
  suppressTableDragSelection: vi.fn(),
}))

import { useEdgeCreateHandlers } from '../../../../../../../vendor/milkdown/packages/components/src/table-block/view/edge-create'

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

function createStartPointerEvent(args: {
  currentTarget: HTMLElement
  pointerId: number
  clientX: number
  clientY: number
}) {
  return {
    button: 0,
    currentTarget: args.currentTarget,
    pointerId: args.pointerId,
    clientX: args.clientX,
    clientY: args.clientY,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  } as unknown as PointerEvent
}

function dispatchDocumentPointerEvent(args: {
  type: 'pointermove' | 'pointerup'
  pointerId: number
  clientX: number
  clientY: number
}) {
  const event = new Event(args.type, {
    bubbles: true,
    cancelable: true,
  })

  Object.defineProperties(event, {
    pointerId: {
      configurable: true,
      value: args.pointerId,
    },
    clientX: {
      configurable: true,
      value: args.clientX,
    },
    clientY: {
      configurable: true,
      value: args.clientY,
    },
  })

  document.dispatchEvent(event)
}

function createHarness() {
  const content = document.createElement('table')
  const firstRow = document.createElement('tr')
  const secondRow = document.createElement('tr')
  firstRow.appendChild(document.createElement('td'))
  firstRow.appendChild(document.createElement('td'))
  secondRow.appendChild(document.createElement('td'))
  secondRow.appendChild(document.createElement('td'))
  content.append(firstRow, secondRow)
  document.body.appendChild(content)

  let width = 240
  let height = 80
  setRect(content, {
    left: 100,
    top: 120,
    width,
    height,
  })

  const updateRect = () => {
    setRect(content, {
      left: 100,
      top: 120,
      width,
      height,
    })
  }

  const refs = {
    tableWrapperRef: { value: undefined },
    contentWrapperRef: { value: content },
    yLineHandleRef: { value: undefined },
    xLineHandleRef: { value: undefined },
    lineHoverIndex: { value: [-1, -1] as [number, number] },
  } as never

  const onAddRow = vi.fn(() => {
    const row = document.createElement('tr')
    row.appendChild(document.createElement('td'))
    row.appendChild(document.createElement('td'))
    content.appendChild(row)
    height += 40
    updateRect()
  })

  const onAddCol = vi.fn(() => {
    Array.from(content.querySelectorAll('tr')).forEach((row) => {
      row.appendChild(document.createElement('td'))
    })
    width += 80
    updateRect()
  })

  const handlers = useEdgeCreateHandlers(
    refs,
    () => true,
    onAddRow,
    onAddCol,
    vi.fn(),
    vi.fn(),
    () => false,
    () => false,
    () => 1
  )

  const handle = document.createElement('div')
  handle.setPointerCapture = vi.fn()
  handle.releasePointerCapture = vi.fn()

  return {
    handlers,
    onAddRow,
    onAddCol,
    handle,
  }
}

afterEach(() => {
  document.body.innerHTML = ''
})

describe('edge create handlers', () => {
  it('keeps adding rows while the same bottom-edge drag continues past each new threshold', () => {
    const { handlers, onAddRow, handle } = createHarness()

    handlers.startRowEdgeCreate(
      createStartPointerEvent({
        currentTarget: handle,
        pointerId: 1,
        clientX: 120,
        clientY: 200,
      })
    )

    dispatchDocumentPointerEvent({
      type: 'pointermove',
      pointerId: 1,
      clientX: 120,
      clientY: 207,
    })
    dispatchDocumentPointerEvent({
      type: 'pointermove',
      pointerId: 1,
      clientX: 120,
      clientY: 225,
    })
    dispatchDocumentPointerEvent({
      type: 'pointermove',
      pointerId: 1,
      clientX: 120,
      clientY: 257,
    })
    dispatchDocumentPointerEvent({
      type: 'pointermove',
      pointerId: 1,
      clientX: 120,
      clientY: 285,
    })
    dispatchDocumentPointerEvent({
      type: 'pointerup',
      pointerId: 1,
      clientX: 120,
      clientY: 285,
    })

    expect(onAddRow).toHaveBeenCalledTimes(2)
  })

  it('keeps adding columns while the same right-edge drag continues past each new threshold', () => {
    const { handlers, onAddCol, handle } = createHarness()

    handlers.startColEdgeCreate(
      createStartPointerEvent({
        currentTarget: handle,
        pointerId: 2,
        clientX: 340,
        clientY: 140,
      })
    )

    dispatchDocumentPointerEvent({
      type: 'pointermove',
      pointerId: 2,
      clientX: 347,
      clientY: 140,
    })
    dispatchDocumentPointerEvent({
      type: 'pointermove',
      pointerId: 2,
      clientX: 365,
      clientY: 140,
    })
    dispatchDocumentPointerEvent({
      type: 'pointermove',
      pointerId: 2,
      clientX: 437,
      clientY: 140,
    })
    dispatchDocumentPointerEvent({
      type: 'pointermove',
      pointerId: 2,
      clientX: 465,
      clientY: 140,
    })
    dispatchDocumentPointerEvent({
      type: 'pointerup',
      pointerId: 2,
      clientX: 465,
      clientY: 140,
    })

    expect(onAddCol).toHaveBeenCalledTimes(2)
  })

  it('does not start an edge-create drag while the editor is readonly', () => {
    const content = document.createElement('table')
    const row = document.createElement('tr')
    row.appendChild(document.createElement('td'))
    content.appendChild(row)
    document.body.appendChild(content)
    setRect(content, {
      left: 100,
      top: 120,
      width: 120,
      height: 40,
    })

    const onAddRow = vi.fn()
    const handlers = useEdgeCreateHandlers(
      {
        tableWrapperRef: { value: undefined },
        contentWrapperRef: { value: content },
        yLineHandleRef: { value: undefined },
        xLineHandleRef: { value: undefined },
        lineHoverIndex: { value: [-1, -1] as [number, number] },
      } as never,
      () => false,
      onAddRow,
      vi.fn(),
      vi.fn(),
      vi.fn(),
      () => false,
      () => false,
      () => 1
    )

    const handle = document.createElement('div')
    handle.setPointerCapture = vi.fn()
    handle.releasePointerCapture = vi.fn()

    handlers.startRowEdgeCreate(
      createStartPointerEvent({
        currentTarget: handle,
        pointerId: 3,
        clientX: 120,
        clientY: 160,
      })
    )

    dispatchDocumentPointerEvent({
      type: 'pointermove',
      pointerId: 3,
      clientX: 120,
      clientY: 220,
    })
    dispatchDocumentPointerEvent({
      type: 'pointerup',
      pointerId: 3,
      clientX: 120,
      clientY: 220,
    })

    expect(onAddRow).not.toHaveBeenCalled()
  })
})
