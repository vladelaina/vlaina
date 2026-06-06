import { TextSelection } from 'prosemirror-state'
import {
  deleteColumn as baseDeleteColumn,
} from 'prosemirror-tables'

export * from 'prosemirror-tables'

function isColumnSelection(selection: any): boolean {
  return (
    typeof selection?.isColSelection === 'function'
    && selection.isColSelection()
  )
}

function findTableAroundPos(doc: any, pos: number) {
  const resolvedPos = Math.max(0, Math.min(pos, doc.content?.size ?? pos))
  const $pos = doc.resolve(resolvedPos)

  for (let depth = $pos.depth; depth > 0; depth--) {
    if ($pos.node(depth).type?.name === 'table') {
      return {
        node: $pos.node(depth),
        pos: $pos.before(depth),
      }
    }
  }

  if ($pos.nodeAfter?.type?.name === 'table') {
    return {
      node: $pos.nodeAfter,
      pos: resolvedPos,
    }
  }

  if ($pos.nodeBefore?.type?.name === 'table') {
    return {
      node: $pos.nodeBefore,
      pos: resolvedPos - $pos.nodeBefore.nodeSize,
    }
  }

  return null
}

function findNearestCellPosInTable(table: any, tablePos: number, anchorPos: number) {
  let nearestCellPos: number | null = null
  let nearestDistance = Number.POSITIVE_INFINITY

  table.descendants((node: any, pos: number) => {
    if (node.type?.name !== 'table_cell' && node.type?.name !== 'table_header') {
      return true
    }

    const cellPos = tablePos + 1 + pos
    const distance = Math.abs(cellPos - anchorPos)
    if (distance < nearestDistance) {
      nearestDistance = distance
      nearestCellPos = cellPos
    }

    return true
  })

  return nearestCellPos
}

export function findNearestTableTextSelectionPos(tr: any, anchorPos: number) {
  const mappedAnchor = tr.mapping?.map(anchorPos, -1) ?? anchorPos
  const table = findTableAroundPos(tr.doc, mappedAnchor)
  if (!table) {
    return null
  }

  const nearestCellPos = findNearestCellPosInTable(table.node, table.pos, mappedAnchor)
  if (nearestCellPos == null) {
    return null
  }

  let textblockPos: number | null = null
  const cellNode = tr.doc.nodeAt(nearestCellPos)
  if (!cellNode) {
    return null
  }

  tr.doc.nodesBetween(
    nearestCellPos,
    nearestCellPos + cellNode.nodeSize,
    (node: any, pos: number) => {
      if (textblockPos != null) return false
      if (!node.isTextblock) return true
      textblockPos = pos + 1
      return false
    }
  )

  if (textblockPos == null) {
    return null
  }

  return textblockPos
}

export function normalizeDeletedColumnSelection(tr: any, anchorPos: number) {
  if (!isColumnSelection(tr.selection)) {
    return tr
  }

  const nextSelectionPos = findNearestTableTextSelectionPos(tr, anchorPos)
  if (nextSelectionPos == null) {
    return tr
  }

  return tr.setSelection(TextSelection.create(tr.doc, nextSelectionPos)).scrollIntoView()
}

export function deleteColumn(state: any, dispatch?: ((tr: any) => void) | undefined) {
  if (!dispatch) {
    return baseDeleteColumn(state, dispatch)
  }

  const anchorPos = state.selection?.$anchorCell?.pos ?? state.selection?.from ?? 0

  return baseDeleteColumn(state, (tr) => {
    dispatch(normalizeDeletedColumnSelection(tr, anchorPos))
  })
}
