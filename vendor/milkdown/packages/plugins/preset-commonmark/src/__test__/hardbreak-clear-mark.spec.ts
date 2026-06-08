import '@testing-library/jest-dom/vitest'

import { defaultValueCtx, Editor, editorViewCtx } from '@milkdown/core'
import type { Mark } from '@milkdown/prose/model'
import { expect, it } from 'vitest'

import { commonmark } from '..'
import { clearMarkedHardbreaksInRange } from '../plugin/hardbreak-clear-mark-plugin'

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

it('should map touched hardbreak positions through later transaction steps', async () => {
  const editor = createEditor('one  \ntwo')

  await editor.create()

  const view = editor.ctx.get(editorViewCtx)
  const [hardbreakPos] = getHardbreakPositions(editor)
  const strong = view.state.schema.marks.strong.create()

  expect(hardbreakPos).toBeGreaterThan(0)

  const tr = view.state.tr
    .addMark(hardbreakPos!, hardbreakPos! + 1, strong)
    .insertText('prefix ', 1)
  const finalHardbreakPos = hardbreakPos! + 'prefix '.length

  expect(markNames(tr.doc.nodeAt(finalHardbreakPos)?.marks ?? [])).toEqual([
    'strong',
  ])

  view.dispatch(tr)

  expect(getHardbreakMarksAndAttrs(editor, [finalHardbreakPos])).toEqual([
    { marks: [], attrs: { isInline: false } },
  ])

  await editor.destroy()
})

it('should stop scanning touched hardbreak ranges at the scan budget', () => {
  const hardbreakType = { name: 'hardbreak' }
  const textType = { name: 'text' }
  const visitedPositions: number[] = []
  const clearedPositions: number[] = []
  const nodes = [
    { type: textType, marks: [], attrs: {} },
    { type: hardbreakType, marks: [{ type: { name: 'strong' } }], attrs: { isInline: false } },
    { type: textType, marks: [], attrs: {} },
    { type: hardbreakType, marks: [{ type: { name: 'strong' } }], attrs: { isInline: false } },
  ]
  const tr = {
    doc: {
      content: { size: nodes.length },
      nodesBetween(_from: number, _to: number, callback: (node: any, pos: number) => boolean | void) {
        for (let index = 0; index < nodes.length; index += 1) {
          visitedPositions.push(index)
          if (callback(nodes[index], index) === false) break
        }
      },
    },
    setNodeMarkup(pos: number) {
      clearedPositions.push(pos)
      return this
    },
  } as any

  const result = clearMarkedHardbreaksInRange(tr, hardbreakType, 0, nodes.length, 2)

  expect(result.changed).toBe(true)
  expect(visitedPositions).toEqual([0, 1, 2])
  expect(clearedPositions).toEqual([1])
})
