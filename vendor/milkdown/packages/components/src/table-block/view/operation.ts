import type { Ctx } from '@milkdown/ctx'
import type { EditorView } from '@milkdown/kit/prose/view'

import { commandsCtx, editorViewCtx } from '@milkdown/core'
import { Selection } from '@milkdown/kit/prose/state'
import { TableMap } from '@milkdown/kit/prose/tables'
import {
  addColAfterCommand,
  addColBeforeCommand,
  addRowAfterCommand,
  addRowBeforeCommand,
  deleteSelectedCellsCommand,
  moveColCommand,
  moveRowCommand,
  selectColCommand,
  selectRowCommand,
} from '@milkdown/preset-gfm'

import type { Refs } from './types'
import { rememberTableScroll } from './table-scroll-memory'
import { collectColumnCellRanges, collectRowCellRanges } from './table-column-content'
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

  const restoreSelectionNear = (view: EditorView, from: number) => {
    const docSize = view.state.doc.content.size
    const safeFrom = Math.max(0, Math.min(from, docSize))
    const selection = Selection.near(view.state.doc.resolve(safeFrom), 1)
    view.dispatch(view.state.tr.setSelection(selection))
  }

  const markTableUserInput = (view: EditorView) => {
    view.dom.dispatchEvent(
      new CustomEvent('editor:block-user-input', { bubbles: true })
    )
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

    const view = ctx.get(editorViewCtx)
    if (!view.editable) return

    const shape = getTableShape()
    if (!shape || shape.rowCount === 0 || rowIndex > shape.rowCount) return

    const commands = ctx.get(commandsCtx)
    const pos = getCommandPos()
    if (pos == null) return
    const selectionFrom = view.state.selection.from
    preserveTableScroll(() => {
      markTableUserInput(view)
      if (shape.rowCount === rowIndex) {
        commands.call(selectRowCommand.key, { pos, index: rowIndex - 1 })
        commands.call(addRowAfterCommand.key)
      } else {
        commands.call(selectRowCommand.key, { pos, index: rowIndex })
        commands.call(addRowBeforeCommand.key)
      }

      restoreSelectionNear(view, selectionFrom)
    })
    xHandle.dataset.show = 'false'
  }

  const onAddCol = () => {
    if (!ctx) return
    const xHandle = xLineHandleRef.value
    if (!xHandle) return

    const [_, colIndex] = lineHoverIndex.value!
    if (colIndex < 0) return

    const view = ctx.get(editorViewCtx)
    if (!view.editable) return

    const shape = getTableShape()
    if (!shape || shape.colCount === 0 || colIndex > shape.colCount) return

    const commands = ctx.get(commandsCtx)
    const pos = getCommandPos()
    if (pos == null) return
    const selectionFrom = view.state.selection.from
    preserveTableScroll(() => {
      markTableUserInput(view)
      if (shape.colCount === colIndex) {
        commands.call(selectColCommand.key, { pos, index: colIndex - 1 })
        commands.call(addColAfterCommand.key)
      } else {
        commands.call(selectColCommand.key, { pos, index: colIndex })
        commands.call(addColBeforeCommand.key)
      }

      restoreSelectionNear(view, selectionFrom)
    })
  }

  const onAppendRow = () => {
    if (!ctx) return
    const view = ctx.get(editorViewCtx)
    if (!view.editable) return

    const shape = getTableShape()
    if (!shape || shape.rowCount === 0) return

    const commands = ctx.get(commandsCtx)
    const pos = getCommandPos()
    if (pos == null) return
    const lastRowIndex = shape.rowCount - 1
    const selectionFrom = view.state.selection.from

    preserveTableScroll(() => {
      markTableUserInput(view)
      commands.call(selectRowCommand.key, { pos, index: lastRowIndex })
      commands.call(addRowAfterCommand.key)
      restoreSelectionNear(view, selectionFrom)
    })
  }

  const onAppendCol = () => {
    if (!ctx) return
    const view = ctx.get(editorViewCtx)
    if (!view.editable) return

    const shape = getTableShape()
    if (!shape || shape.colCount === 0) return

    const commands = ctx.get(commandsCtx)
    const pos = getCommandPos()
    if (pos == null) return
    const lastColIndex = shape.colCount - 1
    const selectionFrom = view.state.selection.from

    preserveTableScroll(() => {
      markTableUserInput(view)
      commands.call(selectColCommand.key, { pos, index: lastColIndex })
      commands.call(addColAfterCommand.key)
      restoreSelectionNear(view, selectionFrom)
    })
  }

  const canShrinkRow = () => {
    const shape = getTableShape()
    if (!shape || shape.rowCount <= 1) return false

    const lastRowIndex = shape.rowCount - 1
    for (let colIndex = 0; colIndex < shape.colCount; colIndex += 1) {
      if (!isCellEmpty(lastRowIndex, colIndex)) return false
    }
    return true
  }

  const canShrinkCol = () => {
    const shape = getTableShape()
    if (!shape || shape.colCount <= 1) return false

    const lastColIndex = shape.colCount - 1
    for (let rowIndex = 0; rowIndex < shape.rowCount; rowIndex += 1) {
      if (!isCellEmpty(rowIndex, lastColIndex)) return false
    }
    return true
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
      markTableUserInput(ctx.get(editorViewCtx))
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
      markTableUserInput(ctx.get(editorViewCtx))
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
      markTableUserInput(ctx.get(editorViewCtx))
      commands.call(moveColCommand.key, {
        pos,
        from,
        to,
        select: false,
      })
    })
  }

  const onMoveRow = (from: number, to: number) => {
    if (!ctx) return
    if (!ctx.get(editorViewCtx).editable) return

    const shape = getTableShape()
    if (!shape) return
    if (from < 0 || to < 0) return
    if (from >= shape.rowCount || to >= shape.rowCount) return
    if (from === to) return

    const commands = ctx.get(commandsCtx)
    const pos = getCommandPos()
    if (pos == null) return

    preserveTableScroll(() => {
      markTableUserInput(ctx.get(editorViewCtx))
      commands.call(moveRowCommand.key, {
        pos,
        from,
        to,
      })
    })
  }

  const runWithSelectedCol = (
    index: number,
    effect: (commands: { call: (key: unknown, payload?: unknown) => unknown }) => void,
    restoreSelection = false
  ) => {
    if (!ctx) return
    const view = ctx.get(editorViewCtx)
    if (!view.editable) return

    const shape = getTableShape()
    if (!shape) return
    if (index < 0 || index >= shape.colCount) return

    const commands = ctx.get(commandsCtx)
    const pos = getCommandPos()
    if (pos == null) return
    const selectionFrom = view.state.selection.from

    preserveTableScroll(() => {
      markTableUserInput(view)
      commands.call(selectColCommand.key, { pos, index })
      effect(commands)
      if (restoreSelection) restoreSelectionNear(view, selectionFrom)
    })
  }

  const onInsertColLeft = (index: number) => {
    runWithSelectedCol(index, (commands) => {
      commands.call(addColBeforeCommand.key)
    }, true)
  }

  const onInsertColRight = (index: number) => {
    runWithSelectedCol(index, (commands) => {
      commands.call(addColAfterCommand.key)
    }, true)
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
      markTableUserInput(view)
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

  const runWithSelectedRow = (
    index: number,
    effect: (commands: { call: (key: unknown, payload?: unknown) => unknown }) => void,
    restoreSelection = false
  ) => {
    if (!ctx) return
    const view = ctx.get(editorViewCtx)
    if (!view.editable) return

    const shape = getTableShape()
    if (!shape) return
    if (index < 0 || index >= shape.rowCount) return

    const commands = ctx.get(commandsCtx)
    const pos = getCommandPos()
    if (pos == null) return
    const selectionFrom = view.state.selection.from

    preserveTableScroll(() => {
      markTableUserInput(view)
      commands.call(selectRowCommand.key, { pos, index })
      effect(commands)
      if (restoreSelection) restoreSelectionNear(view, selectionFrom)
    })
  }

  const onInsertRowAbove = (index: number) => {
    runWithSelectedRow(index, (commands) => {
      commands.call(addRowBeforeCommand.key)
    }, true)
  }

  const onInsertRowBelow = (index: number) => {
    runWithSelectedRow(index, (commands) => {
      commands.call(addRowAfterCommand.key)
    }, true)
  }

  const onDeleteRow = (index: number) => {
    runWithSelectedRow(index, (commands) => {
      commands.call(deleteSelectedCellsCommand.key)
    })
  }

  const onClearRowContent = (index: number) => {
    if (!ctx) return
    const view = ctx.get(editorViewCtx)
    if (!view.editable) return

    const table = getTableNode()
    const tablePos = safeGetPos()
    if (!table || tablePos == null) return

    const map = TableMap.get(table)
    if (index < 0 || index >= map.height) return

    const paragraphType = view.state.schema.nodes.paragraph
    if (!paragraphType) return

    const cells = collectRowCellRanges({
      table,
      tablePos,
      tableMap: map,
      index,
    })
    if (cells.length === 0) return

    preserveTableScroll(() => {
      markTableUserInput(view)
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
    onMoveRow,
    onInsertColLeft,
    onInsertColRight,
    onDeleteCol,
    onClearColContent,
    onInsertRowAbove,
    onInsertRowBelow,
    onDeleteRow,
    onClearRowContent,
    canShrinkRow,
    canShrinkCol,
  }
}
