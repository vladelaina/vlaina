import '@testing-library/jest-dom/vitest'

import { defaultValueCtx, Editor, editorViewCtx } from '@milkdown/core'
import type { Mark } from '@milkdown/prose/model'
import { expect, it } from 'vitest'

import { commonmark } from '..'

function createEditor(defaultValue: string) {
  return Editor.make()
    .config((ctx) => {
      ctx.set(defaultValueCtx, defaultValue)
    })
    .use(commonmark)
}

function getHardbreakPositions(editor: Editor) {
  const view = editor.ctx.get(editorViewCtx)
  const positions: number[] = []

  view.state.doc.descendants((node, pos) => {
    if (node.type.name === 'hardbreak') positions.push(pos)
  })

  return positions
}

function getHardbreakMarksAndAttrs(editor: Editor, positions: number[]) {
  const view = editor.ctx.get(editorViewCtx)

  return positions.map((pos) => {
    const node = view.state.doc.nodeAt(pos)
    return {
      marks: node?.marks.map((mark) => mark.type.name) ?? [],
      attrs: node?.attrs,
    }
  })
}

function markNames(marks: readonly Mark[]) {
  return marks.map((mark) => mark.type.name)
}

it('should not append a transaction when marking text without hardbreaks', async () => {
  const editor = createEditor('plain text')

  await editor.create()

  const view = editor.ctx.get(editorViewCtx)
  const strong = view.state.schema.marks.strong.create()
  const result = view.state.applyTransaction(view.state.tr.addMark(1, 6, strong))

  expect(result.transactions).toHaveLength(1)

  await editor.destroy()
})

it('should clear marks from every hardbreak touched by add-mark steps', async () => {
  const editor = createEditor('one  \ntwo  \nthree')

  await editor.create()

  const view = editor.ctx.get(editorViewCtx)
  const positions = getHardbreakPositions(editor)
  const strong = view.state.schema.marks.strong.create()

  expect(positions).toHaveLength(2)

  const tr = view.state.tr
    .addMark(positions[0]!, positions[0]! + 1, strong)
    .addMark(positions[1]!, positions[1]! + 1, strong)

  expect(markNames(tr.doc.nodeAt(positions[0]!)?.marks ?? [])).toEqual([
    'strong',
  ])
  expect(markNames(tr.doc.nodeAt(positions[1]!)?.marks ?? [])).toEqual([
    'strong',
  ])

  view.dispatch(tr)

  expect(getHardbreakMarksAndAttrs(editor, positions)).toEqual([
    { marks: [], attrs: { isInline: false } },
    { marks: [], attrs: { isInline: false } },
  ])

  await editor.destroy()
})
