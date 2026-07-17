import type { Ctx } from '@milkdown/ctx'
import { paragraphSchema } from '@milkdown/preset-commonmark'
import type { Node } from '@milkdown/prose/model'
import { TextSelection, type Command } from '@milkdown/prose/state'

import {
  tableCellSchema,
  tableHeaderRowSchema,
  tableHeaderSchema,
  tableRowSchema,
  tableSchema,
} from './schema'
import { MAX_CREATED_TABLE_COLS } from './utils'

type TableAlignment = 'left' | 'center' | 'right'

const tablePipeCellPattern = /[|｜]/
const tableDelimiterCellPattern = /^:?-+:?$/
const MAX_PIPE_TABLE_SHORTCUT_TEXT_CHARS = 1024

function getPipeShortcutCells(text: string): string[] | null {
  if (text.length > MAX_PIPE_TABLE_SHORTCUT_TEXT_CHARS) return null

  const trimmed = text.trim()
  if (!trimmed.startsWith('|') && !trimmed.startsWith('｜')) return null
  if (!trimmed.endsWith('|') && !trimmed.endsWith('｜')) return null

  const cells = trimmed
    .split(tablePipeCellPattern)
    .slice(1, -1)
    .map((cell) => cell.trim())

  if (cells.length > MAX_CREATED_TABLE_COLS) return null
  return cells.length >= 2 ? cells : null
}

function shouldCreateTableFromPipeShortcut(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed.startsWith('|') && !trimmed.startsWith('｜')) return false
  if (!trimmed.endsWith('|') && !trimmed.endsWith('｜')) return false

  const rawCells = trimmed.split(tablePipeCellPattern).slice(1, -1)
  const nonEmptyCells = rawCells.filter((cell) => cell.trim().length > 0)
  if (nonEmptyCells.length < 2) return false

  return nonEmptyCells.every((cell) => cell === cell.trim())
}

function getTableDelimiterAlignments(text: string): TableAlignment[] | null {
  const cells = getPipeShortcutCells(text)
  if (!cells || cells.some((cell) => !tableDelimiterCellPattern.test(cell))) {
    return null
  }

  return cells.map((cell) => {
    if (cell.startsWith(':') && cell.endsWith(':')) return 'center'
    if (cell.endsWith(':')) return 'right'
    return 'left'
  })
}

function createTableFromPipeCells(
  ctx: Ctx,
  state: Parameters<Command>[0],
  cells: string[],
  alignments: readonly TableAlignment[] = []
): Node {
  const paragraph = paragraphSchema.type(ctx)
  const headerCells = cells.map((cell, index) =>
    tableHeaderSchema.type(ctx).create(
      { alignment: alignments[index] ?? 'left' },
      paragraph.create(null, cell.length > 0 ? state.schema.text(cell) : undefined)
    )
  )
  const bodyCells = cells.map((_, index) =>
    tableCellSchema.type(ctx).createAndFill({ alignment: alignments[index] ?? 'left' })!
  )

  return tableSchema.type(ctx).create(null, [
    tableHeaderRowSchema.type(ctx).create(null, headerCells),
    tableRowSchema.type(ctx).create(null, bodyCells),
  ])
}

export function createTableFromPipeShortcut(
  ctx: Ctx
): Command {
  return (state, dispatch) => {
    const { selection } = state
    if (!(selection instanceof TextSelection) || !selection.empty) return false

    const { $from } = selection
    if ($from.parent.type !== paragraphSchema.type(ctx)) return false
    if ($from.parentOffset !== $from.parent.content.size) return false
    if ($from.depth < 1) return false
    if ($from.parent.content.size > MAX_PIPE_TABLE_SHORTCUT_TEXT_CHARS) return false

    const text = $from.parent.textBetween(0, $from.parent.content.size, '', '')
    if (!shouldCreateTableFromPipeShortcut(text)) return false

    const cells = getPipeShortcutCells(text)
    if (!cells || cells.filter((cell) => cell.length > 0).length < 2) return false

    const parentDepth = $from.depth - 1
    const parent = $from.node(parentDepth)
    if (!parent.canReplaceWith(
      $from.index(parentDepth),
      $from.indexAfter(parentDepth),
      tableSchema.type(ctx)
    )) return false

    const tableNode = createTableFromPipeCells(ctx, state, cells)
    const from = $from.before($from.depth)
    const to = $from.after($from.depth)
    const tr = state.tr.replaceRangeWith(from, to, tableNode)

    dispatch?.(
      tr.setSelection(TextSelection.create(tr.doc, from + 3)).scrollIntoView()
    )
    return true
  }
}

export function createTableFromMarkdownDelimiter(
  ctx: Ctx
): Command {
  return (state, dispatch) => {
    const { selection } = state
    if (!(selection instanceof TextSelection) || !selection.empty) return false

    const { $from } = selection
    if ($from.parent.type !== paragraphSchema.type(ctx)) return false
    if ($from.parentOffset !== $from.parent.content.size || $from.depth < 1) return false

    const delimiterText = $from.parent.textBetween(0, $from.parent.content.size, '', '')
    const alignments = getTableDelimiterAlignments(delimiterText)
    if (!alignments) return false

    const parentDepth = $from.depth - 1
    const parent = $from.node(parentDepth)
    const currentIndex = $from.index(parentDepth)
    if (currentIndex < 1) return false

    const headerParagraph = parent.child(currentIndex - 1)
    if (headerParagraph.type !== paragraphSchema.type(ctx)) return false
    const headerText = headerParagraph.textBetween(0, headerParagraph.content.size, '', '')
    const cells = getPipeShortcutCells(headerText)
    if (!cells || cells.length !== alignments.length) return false

    if (!parent.canReplaceWith(currentIndex - 1, currentIndex + 1, tableSchema.type(ctx))) {
      return false
    }

    const tableNode = createTableFromPipeCells(ctx, state, cells, alignments)
    const delimiterFrom = $from.before($from.depth)
    const from = delimiterFrom - headerParagraph.nodeSize
    const to = $from.after($from.depth)
    const tr = state.tr.replaceRangeWith(from, to, tableNode)
    const firstBodyCellTextPos = from + (tableNode.firstChild?.nodeSize ?? 0) + 4

    dispatch?.(
      tr.setSelection(TextSelection.create(tr.doc, firstBodyCellTextPos)).scrollIntoView()
    )
    return true
  }
}
