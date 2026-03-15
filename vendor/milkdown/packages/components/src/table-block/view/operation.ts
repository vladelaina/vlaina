import type { Ctx } from '@milkdown/ctx'

import { commandsCtx, editorViewCtx } from '@milkdown/core'
import {
  addColAfterCommand,
  addColBeforeCommand,
  addRowAfterCommand,
  addRowBeforeCommand,
  deleteSelectedCellsCommand,
  selectColCommand,
  selectRowCommand,
} from '@milkdown/preset-gfm'

import type { Refs } from './types'
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

  const getTableNode = () => {
    if (!ctx) return
    const pos = getPos?.()
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
    const pos = (getPos?.() ?? 0) + 1
    if (rows.length === rowIndex) {
      commands.call(selectRowCommand.key, { pos, index: rowIndex - 1 })
      commands.call(addRowAfterCommand.key)
    } else {
      commands.call(selectRowCommand.key, { pos, index: rowIndex })
      commands.call(addRowBeforeCommand.key)
    }

    commands.call(selectRowCommand.key, { pos, index: rowIndex })
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

    const pos = (getPos?.() ?? 0) + 1
    if (cols.length === colIndex) {
      commands.call(selectColCommand.key, { pos, index: colIndex - 1 })
      commands.call(addColAfterCommand.key)
    } else {
      commands.call(selectColCommand.key, { pos, index: colIndex })
      commands.call(addColBeforeCommand.key)
    }

    commands.call(selectColCommand.key, { pos, index: colIndex })
  }

  const onAppendRow = () => {
    if (!ctx) return
    if (!ctx.get(editorViewCtx).editable) return

    const shape = getTableShape()
    if (!shape || shape.rowCount === 0) return

    const commands = ctx.get(commandsCtx)
    const pos = (getPos?.() ?? 0) + 1
    const lastRowIndex = shape.rowCount - 1

    commands.call(selectRowCommand.key, { pos, index: lastRowIndex })
    commands.call(addRowAfterCommand.key)
  }

  const onAppendCol = () => {
    if (!ctx) return
    if (!ctx.get(editorViewCtx).editable) return

    const shape = getTableShape()
    if (!shape || shape.colCount === 0) return

    const commands = ctx.get(commandsCtx)
    const pos = (getPos?.() ?? 0) + 1
    const lastColIndex = shape.colCount - 1

    commands.call(selectColCommand.key, { pos, index: lastColIndex })
    commands.call(addColAfterCommand.key)
  }

  const canShrinkRow = () => {
    const shape = getTableShape()
    if (!shape || shape.rowCount <= 2) return false

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
    const pos = (getPos?.() ?? 0) + 1
    const lastRowIndex = shape.rowCount - 1

    commands.call(selectRowCommand.key, { pos, index: lastRowIndex })
    commands.call(deleteSelectedCellsCommand.key)
  }

  const onShrinkCol = () => {
    if (!ctx) return
    if (!ctx.get(editorViewCtx).editable) return
    if (!canShrinkCol()) return

    const shape = getTableShape()
    if (!shape) return
    const commands = ctx.get(commandsCtx)
    const pos = (getPos?.() ?? 0) + 1
    const lastColIndex = shape.colCount - 1

    commands.call(selectColCommand.key, { pos, index: lastColIndex })
    commands.call(deleteSelectedCellsCommand.key)
  }

  return {
    onAddRow,
    onAddCol,
    onAppendRow,
    onAppendCol,
    onShrinkRow,
    onShrinkCol,
    canShrinkRow,
    canShrinkCol,
  }
}
