import type { Ctx } from '@milkdown/ctx'
import type { Node } from '@milkdown/prose/model'
import type {
  EditorView,
  NodeView,
  NodeViewConstructor,
  ViewMutationRecord,
} from '@milkdown/prose/view'

import { tableSchema } from '@milkdown/preset-gfm'
import { $view } from '@milkdown/utils'
import { createApp, type App } from 'vue'

import { withMeta } from '../../__internal__/meta'
import { TableBlock } from './component'

export class TableNodeView implements NodeView {
  dom: HTMLElement
  contentDOM: HTMLElement
  app: App

  constructor(
    public ctx: Ctx,
    public node: Node,
    public view: EditorView,
    public getPos: () => number | undefined
  ) {
    const dom = document.createElement('div')
    dom.className = 'milkdown-table-block'

    const contentDOM = document.createElement('tbody')
    this.contentDOM = contentDOM
    contentDOM.setAttribute('data-content-dom', 'true')
    contentDOM.classList.add('content-dom')

    const app = createApp(TableBlock, {
      view,
      ctx,
      getPos,
      onMount: (div: Element) => {
        div.appendChild(contentDOM)
      },
    })
    app.mount(dom)
    this.app = app

    this.dom = dom
  }

  update(node: Node) {
    if (node.type !== this.node.type) return false

    if (node.sameMarkup(this.node) && node.content.eq(this.node.content))
      return false

    this.node = node

    return true
  }

  stopEvent(e: Event) {
    if (e.type === 'drop' || e.type.startsWith('drag')) return true

    if (e.type === 'mousedown' || e.type === 'pointerdown') {
      if (e.target instanceof Element && e.target.closest('button')) return true
      if (
        e.target instanceof Element &&
        e.target.closest(
          '[data-role="x-line-drag-handle"], [data-role="y-line-drag-handle"], [data-role="bottom-edge-create-zone"], [data-role="right-edge-create-zone"], [data-role="corner-edge-create-zone"]'
        )
      ) {
        return true
      }
    }

    return false
  }

  ignoreMutation(mutation: ViewMutationRecord) {
    if (!this.dom || !this.contentDOM) return true

    if ((mutation.type as unknown) === 'selection') return false

    if (this.contentDOM === mutation.target && mutation.type === 'attributes')
      return true

    if (this.contentDOM.contains(mutation.target)) return false

    return true
  }

  destroy() {
    this.app.unmount()
    this.dom.remove()
    this.contentDOM.remove()
  }
}

export const tableBlockView = $view(
  tableSchema.node,
  (ctx): NodeViewConstructor => {
    return (initialNode, view, getPos) => {
      return new TableNodeView(ctx, initialNode, view, getPos)
    }
  }
)

withMeta(tableBlockView, {
  displayName: 'NodeView<table-block>',
  group: 'TableBlock',
})
