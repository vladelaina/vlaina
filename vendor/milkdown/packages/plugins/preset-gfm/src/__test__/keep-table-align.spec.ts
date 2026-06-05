import '@testing-library/jest-dom/vitest'

import { defaultValueCtx, Editor, editorViewCtx } from '@milkdown/core'
import { commonmark } from '@milkdown/preset-commonmark'
import { expect, it } from 'vitest'

import { gfm } from '..'

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

it('should not append a transaction for non-table edits', async () => {
  const editor = createEditor('plain text')

  await editor.create()

  const view = editor.ctx.get(editorViewCtx)
  const result = view.state.applyTransaction(view.state.tr.insertText('!', 1))

  expect(result.transactions).toHaveLength(1)

  await editor.destroy()
})

it('should sync table body cell alignment from the header row', async () => {
  const editor = createEditor()

  await editor.create()

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
  const tableNode = table.create(null, [
    tableHeaderRow.create(null, [
      tableHeader.create(
        { alignment: 'right' },
        paragraph.create(null, schema.text('Head'))
      ),
    ]),
    tableRow.create(null, [
      tableCell.create(
        { alignment: 'left' },
        paragraph.create(null, schema.text('Body'))
      ),
    ]),
  ])
  const result = view.state.applyTransaction(
    view.state.tr.replaceWith(0, view.state.doc.content.size, tableNode)
  )

  view.updateState(result.state)

  expect(result.transactions).toHaveLength(2)
  expect(findFirstBodyCellAlignment(editor)).toBe('right')

  await editor.destroy()
})
