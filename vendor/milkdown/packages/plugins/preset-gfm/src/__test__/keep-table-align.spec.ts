import '@testing-library/jest-dom/vitest'

import { defaultValueCtx, Editor, editorViewCtx } from '@milkdown/core'
import { commonmark } from '@milkdown/preset-commonmark'
import { expect, it, vi } from 'vitest'

import { gfm } from '..'
import { collectAffectedTablePositions } from '../plugin/keep-table-align-plugin'

function createEditor(defaultValue = '') {
  return Editor.make()
    .config((ctx) => {
      ctx.set(defaultValueCtx, defaultValue)
    })
    .use(commonmark)
    .use(gfm)
}

function findFirstBodyCellAlignment(editor: Editor) {
  const view = editor.ctx.get(editorViewCtx)
  let alignment: unknown

  view.state.doc.descendants((node) => {
    if (node.type.name === 'table_cell') {
      alignment = node.attrs.alignment
      return false
    }
    return true
  })

  return alignment
}

function findFirstNodePos(editor: Editor, typeName: string) {
  const view = editor.ctx.get(editorViewCtx)
  let found: number | null = null

  view.state.doc.descendants((node, pos) => {
    if (found !== null) return false
    if (node.type.name !== typeName) return true

    found = pos
    return false
  })

  if (found === null) {
    throw new Error(`Expected ${typeName} node`)
  }
  return found
}

function createSingleColumnTable(editor: Editor, headerAlignment: string, bodyAlignment: string) {
  const view = editor.ctx.get(editorViewCtx)
  const { schema } = view.state
  const {
    paragraph,
    table,
    table_cell: tableCell,
    table_header: tableHeader,
    table_header_row: tableHeaderRow,
    table_row: tableRow,
  } = schema.nodes

  return table.create(null, [
    tableHeaderRow.create(null, [
      tableHeader.create(
        { alignment: headerAlignment },
        paragraph.create(null, schema.text('Head'))
      ),
    ]),
    tableRow.create(null, [
      tableCell.create(
        { alignment: bodyAlignment },
        paragraph.create(null, schema.text('Body'))
      ),
    ]),
  ])
}

it('should not append a transaction for non-table edits', async () => {
  const editor = createEditor('plain text')

  await editor.create()

  const view = editor.ctx.get(editorViewCtx)
  const result = view.state.applyTransaction(view.state.tr.insertText('!', 1))

  expect(result.transactions).toHaveLength(1)

  await editor.destroy()
})

it('should collect affected tables for non-table edits without scanning the whole document', async () => {
  const editor = createEditor('plain text')

  await editor.create()

  const view = editor.ctx.get(editorViewCtx)
  const tr = view.state.tr.insertText('!', 1)
  const descendants = vi.spyOn(tr.doc, 'descendants').mockImplementation(() => {
    throw new Error('Document descendants should not be scanned')
  })
  const nodesBetween = vi.spyOn(tr.doc, 'nodesBetween')
  const result = collectAffectedTablePositions(tr.doc, [tr])

  expect(result.size).toBe(0)
  expect(descendants).not.toHaveBeenCalled()
  expect(nodesBetween).toHaveBeenCalled()
  expect(nodesBetween.mock.calls[0]?.[0]).toBeGreaterThan(0)
  expect(nodesBetween.mock.calls[0]?.[1]).toBeLessThan(tr.doc.content.size)

  await editor.destroy()
})

it('should sync table body cell alignment from the header row', async () => {
  const editor = createEditor()

  await editor.create()

  const view = editor.ctx.get(editorViewCtx)
  const tableNode = createSingleColumnTable(editor, 'right', 'left')
  const result = view.state.applyTransaction(
    view.state.tr.replaceWith(0, view.state.doc.content.size, tableNode)
  )

  view.updateState(result.state)

  expect(result.transactions).toHaveLength(2)
  expect(findFirstBodyCellAlignment(editor)).toBe('right')

  await editor.destroy()
})

it('should sync table body cell alignment when only the header cell changes', async () => {
  const editor = createEditor()

  await editor.create()

  const view = editor.ctx.get(editorViewCtx)
  const tableNode = createSingleColumnTable(editor, 'left', 'left')
  const initialResult = view.state.applyTransaction(
    view.state.tr.replaceWith(0, view.state.doc.content.size, tableNode)
  )

  view.updateState(initialResult.state)

  const headerPos = findFirstNodePos(editor, 'table_header')
  const result = view.state.applyTransaction(
    view.state.tr.setNodeMarkup(headerPos, undefined, { alignment: 'right' })
  )

  view.updateState(result.state)

  expect(result.transactions).toHaveLength(2)
  expect(findFirstBodyCellAlignment(editor)).toBe('right')

  await editor.destroy()
})
