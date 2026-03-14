import type { Node } from '@milkdown/prose/model'
import type { EditorState, Transaction } from '@milkdown/prose/state'

import { Plugin, PluginKey } from '@milkdown/prose/state'
import { $prose } from '@milkdown/utils'

import { withMeta } from '../__internal__'
import { bulletListSchema } from '../node'
import { listItemSchema } from '../node/list-item'
import { orderedListSchema } from '../node/ordered-list'

/// This plugin is used to keep the label of list item up to date in ordered list.
export const syncListOrderPlugin = $prose((ctx) => {
  const syncOrderLabel = (
    transactions: readonly Transaction[],
    _oldState: EditorState,
    newState: EditorState
  ) => {
    // Skip if composing or not editable
    if (
      !newState.selection ||
      transactions.some(
        (tr) => tr.getMeta('addToHistory') === false || !tr.isGeneric
      )
    )
      return null

    const orderedListType = orderedListSchema.type(ctx)
    const bulletListType = bulletListSchema.type(ctx)
    const listItemType = listItemSchema.type(ctx)

    const handleNodeItem = (
      attrs: Record<string, any>,
      index: number,
      order: number
    ): boolean => {
      let changed = false
      const expectedLabel = `${index + order}.`
      if (attrs.label !== expectedLabel) {
        attrs.label = expectedLabel
        changed = true
      }

      return changed
    }

    let tr = newState.tr
    let needDispatch = false

    newState.doc.descendants(
      (node: Node, pos: number, parent: Node | null, index: number) => {
        if (node.type === bulletListType) {
          const base = node.maybeChild(0)
          if (
            base?.type === listItemType &&
            base.attrs.listType === 'ordered'
          ) {
            const order = Number.parseInt(base.attrs.label, 10) || 1
            needDispatch = true
            tr.setNodeMarkup(pos, orderedListType, {
              order,
              spread: Boolean(node.attrs.spread),
            })

            node.descendants(
              (
                child: Node,
                pos: number,
                _parent: Node | null,
                index: number
              ) => {
                if (child.type === listItemType) {
                  const attrs = { ...child.attrs }
                  const changed = handleNodeItem(attrs, index, order)
                  if (changed) tr = tr.setNodeMarkup(pos, undefined, attrs)
                }
                return false
              }
            )
          }
        } else if (
          node.type === listItemType &&
          parent?.type === orderedListType
        ) {
          const attrs = { ...node.attrs }
          let changed = false
          if (attrs.listType !== 'ordered') {
            attrs.listType = 'ordered'
            changed = true
          }

          const order = parent.attrs.order ?? 1
          changed = handleNodeItem(attrs, index, order) || changed

          if (changed) {
            tr = tr.setNodeMarkup(pos, undefined, attrs)
            needDispatch = true
          }
        }
      }
    )

    return needDispatch ? tr.setMeta('addToHistory', false) : null
  }

  return new Plugin({
    key: new PluginKey('MILKDOWN_KEEP_LIST_ORDER'),
    appendTransaction: syncOrderLabel,
  })
})

withMeta(syncListOrderPlugin, {
  displayName: 'Prose<syncListOrderPlugin>',
  group: 'Prose',
})
