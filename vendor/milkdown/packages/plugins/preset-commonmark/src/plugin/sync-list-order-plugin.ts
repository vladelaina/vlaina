import type { Node, NodeType } from '@milkdown/prose/model'
import type { EditorState, Transaction } from '@milkdown/prose/state'

import { Plugin, PluginKey } from '@milkdown/prose/state'
import { $prose } from '@milkdown/utils'

import { withMeta } from '../__internal__'
import { bulletListSchema } from '../node'
import { listItemSchema } from '../node/list-item'
import { orderedListSchema } from '../node/ordered-list'

function positionTouchesList(
  doc: Node,
  pos: number,
  listTypes: readonly NodeType[]
) {
  const resolvedPos = Math.max(0, Math.min(pos, doc.content.size))
  const $pos = doc.resolve(resolvedPos)

  for (let depth = $pos.depth; depth > 0; depth--) {
    if (listTypes.includes($pos.node(depth).type)) return true
  }

  return (
    ($pos.nodeBefore && listTypes.includes($pos.nodeBefore.type)) ||
    ($pos.nodeAfter && listTypes.includes($pos.nodeAfter.type))
  )
}

function rangeTouchesList(
  doc: Node,
  from: number,
  to: number,
  listTypes: readonly NodeType[]
) {
  const start = Math.max(0, Math.min(from - 1, doc.content.size))
  const end = Math.max(start, Math.min(to + 1, doc.content.size))
  if (
    positionTouchesList(doc, start, listTypes) ||
    positionTouchesList(doc, end, listTypes)
  ) {
    return true
  }

  let hasList = false
  doc.nodesBetween(start, end, (node) => {
    if (listTypes.includes(node.type)) {
      hasList = true
      return false
    }
    return !hasList
  })

  return hasList
}

export function docChangeMayAffectListOrder(
  prevDoc: Node,
  nextDoc: Node,
  listTypes: readonly NodeType[]
) {
  const diffStart = prevDoc.content.findDiffStart(nextDoc.content)
  if (diffStart === null) return false

  const diffEnd = prevDoc.content.findDiffEnd(nextDoc.content)
  if (!diffEnd) return true

  return (
    rangeTouchesList(prevDoc, diffStart, diffEnd.a, listTypes) ||
    rangeTouchesList(nextDoc, diffStart, diffEnd.b, listTypes)
  )
}

/// This plugin is used to keep the label of list item up to date in ordered list.
export const syncListOrderPlugin = $prose((ctx) => {
  const syncOrderLabel = (
    transactions: readonly Transaction[],
    _oldState: EditorState,
    newState: EditorState
  ) => {
    if (!transactions.some((tr) => tr.docChanged)) return null

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
    if (
      !docChangeMayAffectListOrder(_oldState.doc, newState.doc, [
        orderedListType,
        bulletListType,
        listItemType,
      ])
    )
      return null

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
          const parentPos = pos
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
                childPos: number,
                _parent: Node | null,
                index: number
              ) => {
                if (child.type === listItemType) {
                  const attrs = { ...child.attrs }
                  const changed = handleNodeItem(attrs, index, order)
                  if (changed) {
                    tr = tr.setNodeMarkup(
                      parentPos + 1 + childPos,
                      undefined,
                      attrs
                    )
                    needDispatch = true
                  }
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
