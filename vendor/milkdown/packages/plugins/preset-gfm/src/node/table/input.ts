import { commandsCtx } from '@milkdown/core'
import { paragraphSchema } from '@milkdown/preset-commonmark'
import { InputRule } from '@milkdown/prose/inputrules'
import { Fragment, Slice } from '@milkdown/prose/model'
import { TextSelection, type Command } from '@milkdown/prose/state'
import { $inputRule, $pasteRule, $useKeymap } from '@milkdown/utils'

import { withMeta } from '../../__internal__'
import {
  exitTable,
  goToNextTableCellCommand,
  goToPrevTableCellCommand,
} from './command'
import { tableHeaderSchema, tableSchema } from './schema'
import { createTable } from './utils'

const normalizeTableShortcutNumber = (value: string) =>
  value.replace(/[０-９]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) - 0xfee0)
  )

const tablePipeCellPattern = /[|｜]/

function getPipeShortcutColumnCount(text: string): number | null {
  const trimmed = text.trim()
  if (!trimmed.startsWith('|') && !trimmed.startsWith('｜')) return null
  if (!trimmed.endsWith('|') && !trimmed.endsWith('｜')) return null

  const cells = trimmed
    .split(tablePipeCellPattern)
    .map((cell) => cell.trim())
    .filter((cell) => cell.length > 0)

  return cells.length >= 2 ? cells.length : null
}

function createTableFromPipeShortcut(ctx: Parameters<typeof createTable>[0]): Command {
  return (state, dispatch) => {
    const { selection } = state
    if (!(selection instanceof TextSelection) || !selection.empty) return false

    const { $from } = selection
    if ($from.parent.type !== paragraphSchema.type(ctx)) return false
    if ($from.parent.childCount !== 1 || !$from.parent.firstChild?.isText) return false
    if ($from.parentOffset !== $from.parent.content.size) return false
    if ($from.depth < 1) return false

    const columnCount = getPipeShortcutColumnCount($from.parent.textContent)
    if (!columnCount) return false

    const parent = $from.node($from.depth - 1)
    if (
      !parent.canReplaceWith(
        $from.index($from.depth - 1),
        $from.indexAfter($from.depth - 1),
        tableSchema.type(ctx)
      )
    ) {
      return false
    }

    const tableNode = createTable(ctx, 2, columnCount)
    const from = $from.before($from.depth)
    const to = $from.after($from.depth)
    const tr = state.tr.replaceRangeWith(from, to, tableNode)

    dispatch?.(
      tr.setSelection(TextSelection.create(tr.doc, from + 3)).scrollIntoView()
    )

    return true
  }
}

/// A input rule for creating table.
/// For example, `|2x2|` will create a 2x2 table.
export const insertTableInputRule = $inputRule(
  (ctx) =>
    new InputRule(
      /^[|｜](?<col>[0-9０-９]+)[xX×](?<row>[0-9０-９]+)[|｜]\s$/,
      (state, match, start, end) => {
        const $start = state.doc.resolve(start)
        if (
          !$start
            .node(-1)
            .canReplaceWith(
              $start.index(-1),
              $start.indexAfter(-1),
              tableSchema.type(ctx)
            )
        )
          return null

        const row = Math.max(
          Number(normalizeTableShortcutNumber(match.groups?.row ?? '0')),
          2
        )

        const tableNode = createTable(
          ctx,
          row,
          Number(normalizeTableShortcutNumber(match.groups?.col ?? '0'))
        )
        const tr = state.tr.replaceRangeWith(start, end, tableNode)
        return tr
          .setSelection(TextSelection.create(tr.doc, start + 3))
          .scrollIntoView()
      }
    )
)

withMeta(insertTableInputRule, {
  displayName: 'InputRule<insertTableInputRule>',
  group: 'Table',
})

/// A paste rule for fixing tables without header cells.
/// This is a workaround for some editors (e.g. Google Docs) which allow creating tables without header cells,
/// which is not supported by Markdown schema.
/// This paste rule will add header cells to the first row if it's missing.
export const tablePasteRule = $pasteRule((ctx) => ({
  run: (slice, _view, isPlainText) => {
    if (isPlainText) {
      return slice
    }
    let fragment = slice.content

    slice.content.forEach((node, _offset, index) => {
      if (node?.type !== tableSchema.type(ctx)) {
        return
      }
      const rowsCount = node.childCount
      const colsCount = node.lastChild?.childCount ?? 0
      if (rowsCount === 0 || colsCount === 0) {
        fragment = fragment.replaceChild(
          index,
          paragraphSchema.type(ctx).create()
        )
        return
      }

      const headerRow = node.firstChild
      const needToFixHeaderRow =
        colsCount > 0 && headerRow && headerRow.childCount === 0
      if (!needToFixHeaderRow) {
        return
      }
      // Fix for tables with rows but no cells in the first row
      const headerCells = Array(colsCount)
        .fill(0)
        .map(() => tableHeaderSchema.type(ctx).createAndFill()!)

      const tableCells = new Slice(Fragment.from(headerCells), 0, 0)

      const newHeaderRow = headerRow.replace(0, 0, tableCells)
      const newTable = node.replace(
        0,
        headerRow.nodeSize,
        new Slice(Fragment.from(newHeaderRow), 0, 0)
      )
      fragment = fragment.replaceChild(index, newTable)
    })

    return new Slice(Fragment.from(fragment), slice.openStart, slice.openEnd)
  },
}))

withMeta(tablePasteRule, {
  displayName: 'PasteRule<table>',
  group: 'Table',
})

/// Keymap for table commands.
/// - `<Mod-]>`/`<Tab>`: Move to the next cell.
/// - `<Mod-[>`/`<Shift-Tab>`: Move to the previous cell.
/// - `<Mod-Enter>`: Exit the table, and break it if possible.
export const tableKeymap = $useKeymap('tableKeymap', {
  CreateTableFromPipeShortcut: {
    priority: 1000,
    shortcuts: 'Enter',
    command: (ctx) => createTableFromPipeShortcut(ctx),
  },
  NextCell: {
    priority: 100,
    shortcuts: ['Mod-]', 'Tab'],
    command: (ctx) => {
      const commands = ctx.get(commandsCtx)

      return () => commands.call(goToNextTableCellCommand.key)
    },
  },
  PrevCell: {
    shortcuts: ['Mod-[', 'Shift-Tab'],
    command: (ctx) => {
      const commands = ctx.get(commandsCtx)

      return () => commands.call(goToPrevTableCellCommand.key)
    },
  },
  ExitTable: {
    shortcuts: ['Mod-Enter', 'Enter'],
    command: (ctx) => {
      const commands = ctx.get(commandsCtx)

      return () => commands.call(exitTable.key)
    },
  },
})

withMeta(tableKeymap.ctx, {
  displayName: 'KeymapCtx<table>',
  group: 'Table',
})

withMeta(tableKeymap.shortcuts, {
  displayName: 'Keymap<table>',
  group: 'Table',
})
