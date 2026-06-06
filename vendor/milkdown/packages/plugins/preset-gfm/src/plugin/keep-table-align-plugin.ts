import type { Node } from '@milkdown/prose/model'
import type { Transaction } from '@milkdown/prose/state'

import { Plugin, PluginKey } from '@milkdown/prose/state'
import { $prose } from '@milkdown/utils'

import { withMeta } from '../__internal__'

const pluginKey = new PluginKey('MILKDOWN_KEEP_TABLE_ALIGN_PLUGIN')

function addTableAtPos(doc: Node, pos: number, tablePositions: Set<number>) {
  const resolvedPos = Math.max(0, Math.min(pos, doc.content.size))
  const $pos = doc.resolve(resolvedPos)
  for (let depth = $pos.depth; depth > 0; depth--) {
    if ($pos.node(depth).type.name === 'table') {
      tablePositions.add($pos.before(depth))
      return
    }
  }

  if ($pos.nodeAfter?.type.name === 'table') {
    tablePositions.add(resolvedPos)
  }
  if ($pos.nodeBefore?.type.name === 'table') {
    tablePositions.add(resolvedPos - $pos.nodeBefore.nodeSize)
  }
}

function mapChangedPos(
  transactions: readonly Transaction[],
  transactionIndex: number,
  mapIndex: number,
  pos: number,
  assoc: -1 | 1
) {
  let mapped = transactions[transactionIndex].mapping.slice(mapIndex + 1).map(pos, assoc)
  for (let index = transactionIndex + 1; index < transactions.length; index++) {
    mapped = transactions[index].mapping.map(mapped, assoc)
  }
  return mapped
}

export function collectAffectedTablePositions(
  doc: Node,
  transactions: readonly Transaction[]
) {
  const tablePositions = new Set<number>()

  transactions.forEach((transaction, transactionIndex) => {
    if (!transaction.docChanged) return

    transaction.mapping.maps.forEach((map, mapIndex) => {
      map.forEach((_oldStart, _oldEnd, newStart, newEnd) => {
        const from = mapChangedPos(transactions, transactionIndex, mapIndex, newStart, 1)
        const to = mapChangedPos(transactions, transactionIndex, mapIndex, newEnd, -1)
        const rangeFrom = Math.max(0, Math.min(Math.min(from, to), doc.content.size))
        const rangeTo = Math.max(rangeFrom, Math.min(Math.max(from, to), doc.content.size))

        addTableAtPos(doc, rangeFrom, tablePositions)
        addTableAtPos(doc, rangeTo, tablePositions)
        if (rangeFrom === rangeTo) return

        doc.nodesBetween(rangeFrom, rangeTo, (node, pos) => {
          if (node.type.name !== 'table') return true

          tablePositions.add(pos)
          return false
        })
      })
    })
  })

  return tablePositions
}

function syncTableAlignments(
  state: Parameters<NonNullable<Plugin['spec']['appendTransaction']>>[2],
  table: Node,
  tablePos: number,
  transaction: Transaction | undefined
) {
  let tr = transaction
  const tableHeaderRow = table.firstChild
  // TODO: maybe consider add a header row
  if (!tableHeaderRow) return tr

  table.forEach((tableRow, rowOffset, rowIndex) => {
    if (rowIndex === 0 || tableRow.type.name !== 'table_row') return

    tableRow.forEach((node, cellOffset, index) => {
      if (node.type.name !== 'table_cell') return

      const headerCell = tableHeaderRow.maybeChild(index)
      if (!headerCell) return
      const align = headerCell.attrs.alignment
      const currentAlign = node.attrs.alignment
      if (align === currentAlign) return

      if (!tr) tr = state.tr
      tr.setNodeMarkup(tablePos + rowOffset + cellOffset + 2, undefined, {
        ...node.attrs,
        alignment: align,
      })
    })
  })

  return tr
}

export const keepTableAlignPlugin = $prose(() => {
  return new Plugin({
    key: pluginKey,
    appendTransaction: (transactions, oldState, state) => {
      let tr: Transaction | undefined
      if (oldState.doc !== state.doc) {
        collectAffectedTablePositions(state.doc, transactions).forEach((tablePos) => {
          const table = state.doc.nodeAt(tablePos)
          if (table?.type.name !== 'table') return

          tr = syncTableAlignments(state, table, tablePos, tr)
        })
      }

      return tr
    },
  })
})

withMeta(keepTableAlignPlugin, {
  displayName: 'Prose<keepTableAlignPlugin>',
  group: 'Prose',
})
