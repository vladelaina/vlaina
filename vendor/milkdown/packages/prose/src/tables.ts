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

export function findNearestTableTextSelectionPos(tr: any, anchorPos: number) {
  const mappedAnchor = tr.mapping?.map(anchorPos, -1) ?? anchorPos
  let nearestCellPos: number | null = null
  let nearestDistance = Number.POSITIVE_INFINITY

  tr.doc.descendants((node: any, pos: number) => {
    if (node.type?.name !== 'table_cell' && node.type?.name !== 'table_header') {
      return true
    }

    const distance = Math.abs(pos - mappedAnchor)
    if (distance < nearestDistance) {
      nearestDistance = distance
      nearestCellPos = pos
    }

    return true
  })

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
