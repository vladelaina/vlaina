import type { Node, NodeType } from '@milkdown/prose/model'
import type { EditorState, Transaction } from '@milkdown/prose/state'

import { Plugin, PluginKey } from '@milkdown/prose/state'
import { $prose } from '@milkdown/utils'

import { withMeta } from '../__internal__'
import { bulletListSchema } from '../node'
import { listItemSchema } from '../node/list-item'
import { orderedListSchema } from '../node/ordered-list'

export const MAX_LIST_ORDER_SYNC_UPDATES = 5_000

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

interface ListOrderSyncRange {
  from: number
  to: number
}

function addListOrderSyncRange(
  ranges: ListOrderSyncRange[],
  from: number,
  to: number
) {
  if (from >= to) return

  const existing = ranges.find((range) => from >= range.from && to <= range.to)
  if (existing) return

  for (let index = ranges.length - 1; index >= 0; index -= 1) {
    const range = ranges[index]!
    if (range.from >= from && range.to <= to) ranges.splice(index, 1)
  }

  ranges.push({ from, to })
}

function addNearestListOrderSyncRange(
  doc: Node,
  pos: number,
  listContainerTypes: readonly NodeType[],
  ranges: ListOrderSyncRange[]
) {
  const resolvedPos = Math.max(0, Math.min(pos, doc.content.size))
  const $pos = doc.resolve(resolvedPos)

  for (let depth = $pos.depth; depth > 0; depth--) {
    if (listContainerTypes.includes($pos.node(depth).type)) {
      addListOrderSyncRange(ranges, $pos.before(depth), $pos.after(depth))
      return
    }
  }

  const before = $pos.nodeBefore
  if (before && listContainerTypes.includes(before.type)) {
    addListOrderSyncRange(
      ranges,
      resolvedPos - before.nodeSize,
      resolvedPos
    )
  }

  const after = $pos.nodeAfter
  if (after && listContainerTypes.includes(after.type)) {
    addListOrderSyncRange(
      ranges,
      resolvedPos,
      resolvedPos + after.nodeSize
    )
  }
}

function collectChangedListOrderSyncRanges(
  doc: Node,
  from: number,
  to: number,
  listContainerTypes: readonly NodeType[]
) {
  const ranges: ListOrderSyncRange[] = []
  const start = Math.max(0, Math.min(from - 1, doc.content.size))
  const end = Math.max(start, Math.min(to + 1, doc.content.size))

  addNearestListOrderSyncRange(doc, start, listContainerTypes, ranges)
  addNearestListOrderSyncRange(doc, end, listContainerTypes, ranges)

  doc.nodesBetween(start, end, (node, pos) => {
    if (!listContainerTypes.includes(node.type)) return true
    if (pos >= start && pos + node.nodeSize <= end) {
      addListOrderSyncRange(ranges, pos, pos + node.nodeSize)
      return false
    }
    return true
  })

  return ranges
}

export function getListOrderSyncRanges(
  prevDoc: Node,
  nextDoc: Node,
  listTypes: readonly NodeType[],
  listContainerTypes: readonly NodeType[]
) {
  const diffStart = prevDoc.content.findDiffStart(nextDoc.content)
  if (diffStart === null) return []

  const diffEnd = prevDoc.content.findDiffEnd(nextDoc.content)
  if (!diffEnd) return [{ from: 0, to: nextDoc.content.size }]

  const touchesList =
    rangeTouchesList(prevDoc, diffStart, diffEnd.a, listTypes) ||
    rangeTouchesList(nextDoc, diffStart, diffEnd.b, listTypes)
  if (!touchesList) return []

  return collectChangedListOrderSyncRanges(
    nextDoc,
    diffStart,
    diffEnd.b,
    listContainerTypes
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
    const syncRanges = getListOrderSyncRanges(
      _oldState.doc,
      newState.doc,
      [
        orderedListType,
        bulletListType,
        listItemType,
      ],
      [orderedListType, bulletListType]
    )
    if (syncRanges.length === 0) {
      return null
    }

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
    let updateCount = 0

    const canApplyUpdate = () => updateCount < MAX_LIST_ORDER_SYNC_UPDATES

    const setNodeMarkup = (
      pos: number,
      type: NodeType | undefined,
      attrs: Record<string, any>
    ) => {
      if (!canApplyUpdate()) return false
      tr = tr.setNodeMarkup(pos, type, attrs)
      updateCount += 1
      needDispatch = true
      return true
    }

    const syncNodeRange = (from: number, to: number) => {
      newState.doc.nodesBetween(from, to, (
        node: Node,
        pos: number,
        parent: Node | null,
        index: number
      ) => {
        if (node.type === bulletListType) {
          const parentPos = pos
          const base = node.maybeChild(0)
          if (
            base?.type === listItemType &&
            base.attrs.listType === 'ordered'
          ) {
            if (!canApplyUpdate()) return false

            const order = Number.parseInt(base.attrs.label, 10) || 1
            if (!setNodeMarkup(pos, orderedListType, {
              order,
              spread: Boolean(node.attrs.spread),
            })) return false

            let childOffset = 0
            for (
              let childIndex = 0;
              childIndex < node.childCount && canApplyUpdate();
              childIndex += 1
            ) {
              const child = node.child(childIndex)
              if (child.type === listItemType) {
                const attrs = { ...child.attrs }
                const changed = handleNodeItem(attrs, childIndex, order)
                if (
                  changed &&
                  !setNodeMarkup(
                    parentPos + 1 + childOffset,
                    undefined,
                    attrs
                  )
                ) {
                  break
                }
              }
              childOffset += child.nodeSize
            }
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
            if (!setNodeMarkup(pos, undefined, attrs)) return false
          }
        }

        return canApplyUpdate()
      })
    }

    for (const range of syncRanges) {
      if (!canApplyUpdate()) break
      syncNodeRange(range.from, range.to)
    }

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
