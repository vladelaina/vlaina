import type { Ctx } from '@milkdown/ctx'
import type { Node } from '@milkdown/prose/model'

import {
  tableCellSchema,
  tableHeaderRowSchema,
  tableHeaderSchema,
  tableRowSchema,
  tableSchema,
} from '../schema'

export const MAX_CREATED_TABLE_ROWS = 100
export const MAX_CREATED_TABLE_COLS = 50

function normalizeTableSize(value: number | undefined, fallback: number, max: number) {
  if (!Number.isFinite(value)) return fallback
  return Math.max(1, Math.min(Math.floor(value), max))
}

/// @internal
export function createTable(ctx: Ctx, rowsCount = 3, colsCount = 3): Node {
  const rowsSize = normalizeTableSize(rowsCount, 3, MAX_CREATED_TABLE_ROWS)
  const colsSize = normalizeTableSize(colsCount, 3, MAX_CREATED_TABLE_COLS)
  const cells = Array(colsSize)
    .fill(0)
    .map(() => tableCellSchema.type(ctx).createAndFill()!)

  const headerCells = Array(colsSize)
    .fill(0)
    .map(() => tableHeaderSchema.type(ctx).createAndFill()!)

  const rows = Array(rowsSize)
    .fill(0)
    .map((_, i) =>
      i === 0
        ? tableHeaderRowSchema.type(ctx).create(null, headerCells)
        : tableRowSchema.type(ctx).create(null, cells)
    )

  return tableSchema.type(ctx).create(null, rows)
}
