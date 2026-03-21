export interface TableColumnCellLike {
  nodeSize: number
}

export interface TableColumnNodeLike {
  nodeAt: (pos: number) => TableColumnCellLike | null | undefined
}

export interface TableColumnMapLike {
  width: number
  height: number
  cellsInRect: (rect: {
    left: number
    right: number
    top: number
    bottom: number
  }) => number[]
}

export interface ColumnCellRange {
  start: number
  end: number
}

export function collectColumnCellRanges({
  table,
  tablePos,
  tableMap,
  index,
}: {
  table: TableColumnNodeLike
  tablePos: number
  tableMap: TableColumnMapLike
  index: number
}): ColumnCellRange[] {
  if (index < 0 || index >= tableMap.width) return []

  const seen = new Set<number>()
  return tableMap
    .cellsInRect({
      left: index,
      right: index + 1,
      top: 0,
      bottom: tableMap.height,
    })
    .flatMap((nodePos) => {
      if (seen.has(nodePos)) return []
      seen.add(nodePos)

      const node = table.nodeAt(nodePos)
      if (!node) return []

      const pos = tablePos + 1 + nodePos
      return [
        {
          start: pos + 1,
          end: pos + node.nodeSize - 1,
        },
      ]
    })
    .sort((a, b) => b.start - a.start)
}
