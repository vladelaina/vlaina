import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Node as ProseNode } from '@milkdown/kit/prose/model'
import type { EditorView } from '@milkdown/kit/prose/view'

const mountMock = vi.fn()
const unmountMock = vi.fn()
const typeRegistry = new Map<string, { name: string }>()

vi.mock('vue', () => ({
  createApp: vi.fn(() => ({
    mount: mountMock,
    unmount: unmountMock,
  })),
}))

vi.mock('@milkdown/preset-gfm', () => ({
  tableSchema: {
    node: {},
  },
}))

vi.mock('@milkdown/utils', () => ({
  $view: () => ({}),
}))

vi.mock('../../../../../../../vendor/milkdown/packages/components/src/__internal__/meta', () => ({
  withMeta: () => {},
}))

vi.mock('../../../../../../../vendor/milkdown/packages/components/src/table-block/view/component', () => ({
  TableBlock: {
    render: () => null,
  },
}))

import { TableNodeView } from '../../../../../../../vendor/milkdown/packages/components/src/table-block/view/view'

function createMockNode(typeName = 'table'): ProseNode {
  const type =
    typeRegistry.get(typeName) ??
    (() => {
      const nextType = { name: typeName }
      typeRegistry.set(typeName, nextType)
      return nextType
    })()

  return {
    type,
    sameMarkup: vi.fn(() => true),
    content: { eq: vi.fn(() => true) },
  } as unknown as ProseNode
}

function createMockView(): EditorView {
  return {
    editable: true,
  } as unknown as EditorView
}

describe('TableNodeView', () => {
  beforeEach(() => {
    mountMock.mockClear()
    unmountMock.mockClear()
  })

  it('updates in place for the same node type even when markup and content are unchanged', () => {
    const initialNode = createMockNode('table')
    const nextNode = createMockNode('table')
    const nodeView = new TableNodeView(
      {} as never,
      initialNode,
      createMockView(),
      () => 1
    )

    expect(nodeView.update(nextNode)).toBe(true)
    expect(nodeView.node).toBe(nextNode)
  })

  it('returns false when the node type changes', () => {
    const nodeView = new TableNodeView(
      {} as never,
      createMockNode('table'),
      createMockView(),
      () => 1
    )

    expect(nodeView.update(createMockNode('paragraph'))).toBe(false)
  })

  it('does not block ordinary table content mousedown events', () => {
    const nodeView = new TableNodeView(
      {} as never,
      createMockNode('table'),
      createMockView(),
      () => 1
    )
    const cellContent = document.createElement('p')
    const event = new MouseEvent('mousedown')
    Object.defineProperty(event, 'target', {
      value: cellContent,
      configurable: true,
    })

    expect(nodeView.stopEvent(event)).toBe(false)
  })

  it('blocks drag-handle interactions so editor content selection is not hijacked', () => {
    const nodeView = new TableNodeView(
      {} as never,
      createMockNode('table'),
      createMockView(),
      () => 1
    )
    const control = document.createElement('div')
    control.setAttribute('data-role', 'col-header-drag-control')
    const event = new Event('pointerdown')
    Object.defineProperty(event, 'target', {
      value: control,
      configurable: true,
    })

    expect(nodeView.stopEvent(event)).toBe(true)
  })

  it('blocks column menu interactions so editor content selection is not hijacked', () => {
    const nodeView = new TableNodeView(
      {} as never,
      createMockNode('table'),
      createMockView(),
      () => 1
    )
    const menu = document.createElement('div')
    menu.setAttribute('data-role', 'col-header-drag-menu')
    const event = new Event('pointerdown')
    Object.defineProperty(event, 'target', {
      value: menu,
      configurable: true,
    })

    expect(nodeView.stopEvent(event)).toBe(true)
  })

  it('blocks row drag-handle interactions so editor content selection is not hijacked', () => {
    const nodeView = new TableNodeView(
      {} as never,
      createMockNode('table'),
      createMockView(),
      () => 1
    )
    const control = document.createElement('div')
    control.setAttribute('data-role', 'row-header-drag-control')
    const event = new Event('pointerdown')
    Object.defineProperty(event, 'target', {
      value: control,
      configurable: true,
    })

    expect(nodeView.stopEvent(event)).toBe(true)
  })

  it('blocks row menu keyboard events so editor keyboard handling is not hijacked', () => {
    const nodeView = new TableNodeView(
      {} as never,
      createMockNode('table'),
      createMockView(),
      () => 1
    )
    const menu = document.createElement('div')
    menu.setAttribute('data-role', 'row-header-drag-menu')
    const event = new KeyboardEvent('keydown', { key: 'Escape' })
    Object.defineProperty(event, 'target', {
      value: menu,
      configurable: true,
    })

    expect(nodeView.stopEvent(event)).toBe(true)
  })

  it('blocks drag-handle keyboard events so editor keyboard handling is not hijacked', () => {
    const nodeView = new TableNodeView(
      {} as never,
      createMockNode('table'),
      createMockView(),
      () => 1
    )
    const control = document.createElement('div')
    control.setAttribute('data-role', 'col-header-drag-control')
    const event = new KeyboardEvent('keydown', { key: 'Enter' })
    Object.defineProperty(event, 'target', {
      value: control,
      configurable: true,
    })

    expect(nodeView.stopEvent(event)).toBe(true)
  })

  it('blocks column menu keyboard events so editor keyboard handling is not hijacked', () => {
    const nodeView = new TableNodeView(
      {} as never,
      createMockNode('table'),
      createMockView(),
      () => 1
    )
    const menu = document.createElement('div')
    menu.setAttribute('data-role', 'col-header-drag-menu')
    const event = new KeyboardEvent('keydown', { key: 'Escape' })
    Object.defineProperty(event, 'target', {
      value: menu,
      configurable: true,
    })

    expect(nodeView.stopEvent(event)).toBe(true)
  })

  it('blocks column handle context menu events so table control ownership stays local', () => {
    const nodeView = new TableNodeView(
      {} as never,
      createMockNode('table'),
      createMockView(),
      () => 1
    )
    const control = document.createElement('div')
    control.setAttribute('data-role', 'col-header-drag-control')
    const event = new MouseEvent('contextmenu')
    Object.defineProperty(event, 'target', {
      value: control,
      configurable: true,
    })

    expect(nodeView.stopEvent(event)).toBe(true)
  })

  it('resolves the containing cell when the DOM position points at its paragraph', () => {
    const editorDom = document.createElement('div')
    const view = {
      dom: editorDom,
      editable: true,
      posAtDOM: vi.fn(() => 8),
      state: {
        doc: {
          nodeAt: vi.fn(() => ({ type: { name: 'paragraph' } })),
          resolve: vi.fn(() => ({
            depth: 4,
            node: (depth: number) => ({
              type: { name: depth === 3 ? 'table_cell' : 'paragraph' },
            }),
            before: vi.fn(() => 7),
          })),
        },
      },
    } as unknown as EditorView
    const nodeView = new TableNodeView({} as never, createMockNode('table'), view, () => 1)
    const table = document.createElement('table')
    const cell = document.createElement('td')
    const paragraph = document.createElement('p')
    cell.appendChild(paragraph)
    table.appendChild(cell)
    nodeView.dom.appendChild(table)
    const open = vi.fn()
    editorDom.addEventListener('editor:table-context-menu-open', open)

    paragraph.dispatchEvent(new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX: 120,
      clientY: 80,
    }))

    expect(open).toHaveBeenCalledTimes(1)
    expect((open.mock.calls[0]?.[0] as CustomEvent).detail).toEqual({
      cellPos: 7,
      x: 120,
      y: 80,
    })
  })

  it('forwards a cell position returned directly by the DOM mapper', () => {
    const editorDom = document.createElement('div')
    const view = {
      dom: editorDom,
      editable: true,
      posAtDOM: vi.fn(() => 8),
      state: {
        doc: {
          nodeAt: vi.fn(() => ({ type: { name: 'table_cell' } })),
        },
      },
    } as unknown as EditorView
    const nodeView = new TableNodeView({} as never, createMockNode('table'), view, () => 1)
    const table = document.createElement('table')
    const cell = document.createElement('td')
    table.appendChild(cell)
    nodeView.dom.appendChild(table)
    const open = vi.fn()
    editorDom.addEventListener('editor:table-context-menu-open', open)

    cell.dispatchEvent(new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      clientX: 120,
      clientY: 80,
    }))

    expect(open).toHaveBeenCalledTimes(1)
    expect((open.mock.calls[0]?.[0] as CustomEvent).detail.cellPos).toBe(8)
  })

  it('does not ignore child mutations reported on the table host itself', () => {
    const nodeView = new TableNodeView(
      {} as never,
      createMockNode('table'),
      createMockView(),
      () => 1
    )
    const host = document.createElement('table')
    host.appendChild(nodeView.contentDOM)

    expect(
      nodeView.ignoreMutation({
        type: 'childList',
        target: host,
      } as never)
    ).toBe(false)
  })

  it('does not ignore child mutations reported on the node-view root', () => {
    const nodeView = new TableNodeView(
      {} as never,
      createMockNode('table'),
      createMockView(),
      () => 1
    )

    expect(
      nodeView.ignoreMutation({
        type: 'childList',
        target: nodeView.dom,
      } as never)
    ).toBe(false)
  })

  it('does not ignore mutations once contentDOM is detached from the current root', () => {
    const nodeView = new TableNodeView(
      {} as never,
      createMockNode('table'),
      createMockView(),
      () => 1
    )
    const host = document.createElement('table')
    host.appendChild(nodeView.contentDOM)

    expect(
      nodeView.ignoreMutation({
        type: 'childList',
        target: document.createElement('div'),
      } as never)
    ).toBe(false)
  })
})
