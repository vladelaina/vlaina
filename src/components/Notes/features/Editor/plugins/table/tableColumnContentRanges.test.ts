import { describe, expect, it } from 'vitest'

import { collectColumnCellRanges } from '../../../../../../../vendor/milkdown/packages/components/src/table-block/view/table-column-content'

describe('table column content ranges', () => {
  it('deduplicates repeated table map cell positions and sorts ranges from end to start', () => {
    const ranges = collectColumnCellRanges({
      table: {
        nodeAt: (pos: number) => {
          if (pos === 0) return { nodeSize: 6 }
          if (pos === 10) return { nodeSize: 8 }
          return null
        },
      },
      tablePos: 20,
      tableMap: {
        width: 3,
        height: 2,
        cellsInRect: () => [0, 10, 10],
      },
      index: 1,
    })

    expect(ranges).toEqual([
      { start: 32, end: 38 },
      { start: 22, end: 26 },
    ])
  })

  it('returns no ranges when the target column index is out of bounds', () => {
    const ranges = collectColumnCellRanges({
      table: {
        nodeAt: () => ({ nodeSize: 6 }),
      },
      tablePos: 20,
      tableMap: {
        width: 2,
        height: 2,
        cellsInRect: () => [0, 10],
      },
      index: 3,
    })

    expect(ranges).toEqual([])
  })
})
