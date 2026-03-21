import type { Ctx } from '@milkdown/ctx'

import { commandsCtx, editorViewCtx } from '@milkdown/core'
import { TableMap } from '@milkdown/kit/prose/tables'
import {
  addColAfterCommand,
  addColBeforeCommand,
  addRowAfterCommand,
  addRowBeforeCommand,
  deleteSelectedCellsCommand,
  moveColCommand,
  selectColCommand,
  selectRowCommand,
} from '@milkdown/preset-gfm'

import type { Refs } from './types'
import { rememberTableScroll } from './table-scroll-memory'
import { collectColumnCellRanges } from './table-column-content'
import { isTableContentNodeEmpty } from './table-node-content'

export function useOperation(
  refs: Refs,
  ctx?: Ctx,
  getPos?: () => number | undefined
) {
  const {
    xLineHandleRef,
    contentWrapperRef,
    lineHoverIndex,
  } = refs

  const safeGetPos = () => {
    try {
      return getPos?.()
    } catch {
      return undefined
    }
  }

  const getCommandPos = () => {
    const pos = safeGetPos()
    if (pos == null) return null
    return pos + 1
  }

  const getTableNode = () => {
    if (!ctx) return
    const pos = safeGetPos()
    if (pos == null) return
    const view = ctx.get(editorViewCtx)
    return view.state.doc.nodeAt(pos)
  }

  const getTableShape = () => {
    const table = getTableNode()
    if (!table) return

    const rowCount = table.childCount
    const colCount = table.firstChild?.childCount ?? 0

    return {
      table,
      rowCount,
      colCount,
    }
  }

  const preserveTableScroll = (run: () => void) => {
    const scrollElement = contentWrapperRef.value?.closest('.table-scroll')
    if (!(scrollElement instanceof HTMLElement)) {
      run()
      return
    }

    const scrollLeft = scrollElement.scrollLeft
    const scrollTop = scrollElement.scrollTop
    const maxScrollLeft = Math.max(
      0,
      scrollElement.scrollWidth - scrollElement.clientWidth
    )
    rememberTableScroll(safeGetPos(), {
      scrollLeft,
      scrollTop,
      stickToRight: maxScrollLeft > 0 && maxScrollLeft - scrollLeft <= 1,
    })

    run()
  }

  const isCellEmpty = (rowIndex: number, colIndex: number) => {
    const table = getTableNode()
    const cell = table?.child(rowIndex)?.child(colIndex)
    return isTableContentNodeEmpty(cell)
  }

  const onAddRow = () => {
    if (!ctx) return
    const xHandle = xLineHandleRef.value
    if (!xHandle) return

    const [rowIndex] = lineHoverIndex.value!
    if (rowIndex < 0) return

    if (!ctx.get(editorViewCtx).editable) return

    const rows = Array.from(
      contentWrapperRef.value?.querySelectorAll('tr') ?? []
    )
    const commands = ctx.get(commandsCtx)
    const pos = getCommandPos()
    if (pos == null) return
    preserveTableScroll(() => {
      if (rows.length === rowIndex) {
        commands.call(selectRowCommand.key, { pos, index: rowIndex - 1 })
        commands.call(addRowAfterCommand.key)
      } else {
        commands.call(selectRowCommand.key, { pos, index: rowIndex })
        commands.call(addRowBeforeCommand.key)
      }

      commands.call(selectRowCommand.key, { pos, index: rowIndex })
    })
    xHandle.dataset.show = 'false'
  }

  const onAddCol = () => {
    if (!ctx) return
    const xHandle = xLineHandleRef.value
    if (!xHandle) return

    const [_, colIndex] = lineHoverIndex.value!
    if (colIndex < 0) return

    if (!ctx.get(editorViewCtx).editable) return

    const cols = Array.from(
      contentWrapperRef.value?.querySelector('tr')?.children ?? []
    )
    const commands = ctx.get(commandsCtx)
    const pos = getCommandPos()
    if (pos == null) return
    preserveTableScroll(() => {
      if (cols.length === colIndex) {
        commands.call(selectColCommand.key, { pos, index: colIndex - 1 })
        commands.call(addColAfterCommand.key)
      } else {
        commands.call(selectColCommand.key, { pos, index: colIndex })
        commands.call(addColBeforeCommand.key)
      }

      commands.call(selectColCommand.key, { pos, index: colIndex })
    })
  }

  const onAppendRow = () => {
    if (!ctx) return
    if (!ctx.get(editorViewCtx).editable) return

    const shape = getTableShape()
    if (!shape || shape.rowCount === 0) return

    const commands = ctx.get(commandsCtx)
    const pos = getCommandPos()
    if (pos == null) return
    const lastRowIndex = shape.rowCount - 1

    preserveTableScroll(() => {
      commands.call(selectRowCommand.key, { pos, index: lastRowIndex })
      commands.call(addRowAfterCommand.key)
    })
  }

  const onAppendCol = () => {
    if (!ctx) return
    if (!ctx.get(editorViewCtx).editable) return

    const shape = getTableShape()
    if (!shape || shape.colCount === 0) return

    const commands = ctx.get(commandsCtx)
    const pos = getCommandPos()
    if (pos == null) return
    const lastColIndex = shape.colCount - 1

    preserveTableScroll(() => {
      commands.call(selectColCommand.key, { pos, index: lastColIndex })
      commands.call(addColAfterCommand.key)
    })
  }

  const canShrinkRow = () => {
    const shape = getTableShape()
    if (!shape || shape.rowCount <= 1) return false

    const lastRowIndex = shape.rowCount - 1
    return Array.from({ length: shape.colCount }).every((_, colIndex) =>
      isCellEmpty(lastRowIndex, colIndex)
    )
  }

  const canShrinkCol = () => {
    const shape = getTableShape()
    if (!shape || shape.colCount <= 1) return false

    const lastColIndex = shape.colCount - 1
    return Array.from({ length: shape.rowCount }).every((_, rowIndex) =>
      isCellEmpty(rowIndex, lastColIndex)
    )
  }

  const onShrinkRow = () => {
    if (!ctx) return
    if (!ctx.get(editorViewCtx).editable) return
    if (!canShrinkRow()) return

    const shape = getTableShape()
    if (!shape) return
    const commands = ctx.get(commandsCtx)
    const pos = getCommandPos()
    if (pos == null) return
    const lastRowIndex = shape.rowCount - 1

    preserveTableScroll(() => {
      commands.call(selectRowCommand.key, { pos, index: lastRowIndex })
      commands.call(deleteSelectedCellsCommand.key)
    })
  }

  const onShrinkCol = () => {
    if (!ctx) return
    if (!ctx.get(editorViewCtx).editable) return
    if (!canShrinkCol()) return

    const shape = getTableShape()
    if (!shape) return
    const commands = ctx.get(commandsCtx)
    const pos = getCommandPos()
    if (pos == null) return
    const lastColIndex = shape.colCount - 1

    preserveTableScroll(() => {
      commands.call(selectColCommand.key, { pos, index: lastColIndex })
      commands.call(deleteSelectedCellsCommand.key)
    })
  }

  const onMoveCol = (from: number, to: number) => {
    if (!ctx) return
    if (!ctx.get(editorViewCtx).editable) return

    const shape = getTableShape()
    if (!shape) return
    if (from < 0 || to < 0) return
    if (from >= shape.colCount || to >= shape.colCount) return
    if (from === to) return

    const commands = ctx.get(commandsCtx)
    const pos = getCommandPos()
    if (pos == null) return

    preserveTableScroll(() => {
      commands.call(moveColCommand.key, {
        pos,
        from,
        to,
        select: false,
      })
    })
  }

  const runWithSelectedCol = (
    index: number,
    effect: (commands: { call: (key: unknown, payload?: unknown) => unknown }) => void
  ) => {
    if (!ctx) return
    if (!ctx.get(editorViewCtx).editable) return

    const shape = getTableShape()
    if (!shape) return
    if (index < 0 || index >= shape.colCount) return

    const commands = ctx.get(commandsCtx)
    const pos = getCommandPos()
    if (pos == null) return

    preserveTableScroll(() => {
      commands.call(selectColCommand.key, { pos, index })
      effect(commands)
    })
  }

  const onInsertColLeft = (index: number) => {
    runWithSelectedCol(index, (commands) => {
      commands.call(addColBeforeCommand.key)
    })
  }

  const onInsertColRight = (index: number) => {
    runWithSelectedCol(index, (commands) => {
      commands.call(addColAfterCommand.key)
    })
  }

  const onDeleteCol = (index: number) => {
    runWithSelectedCol(index, (commands) => {
      commands.call(deleteSelectedCellsCommand.key)
    })
  }

  const onClearColContent = (index: number) => {
    if (!ctx) return
    const view = ctx.get(editorViewCtx)
    if (!view.editable) return

    const table = getTableNode()
    const tablePos = safeGetPos()
    if (!table || tablePos == null) return

    const map = TableMap.get(table)
    if (index < 0 || index >= map.width) return

    const paragraphType = view.state.schema.nodes.paragraph
    if (!paragraphType) return

    const cells = collectColumnCellRanges({
      table,
      tablePos,
      tableMap: map,
      index,
    })
    if (cells.length === 0) return

    preserveTableScroll(() => {
      let tr = view.state.tr
      for (const cell of cells) {
        const emptyParagraph = paragraphType.createAndFill?.()
        if (!emptyParagraph) continue
        tr = tr.replaceWith(cell.start, cell.end, emptyParagraph)
      }
      if (tr.docChanged) {
        view.dispatch(tr)
      }
    })
  }

  return {
    onAddRow,
    onAddCol,
    onAppendRow,
    onAppendCol,
    onShrinkRow,
    onShrinkCol,
    onMoveCol,
    onInsertColLeft,
    onInsertColRight,
    onDeleteCol,
    onClearColContent,
    canShrinkRow,
    canShrinkCol,
  }
}
