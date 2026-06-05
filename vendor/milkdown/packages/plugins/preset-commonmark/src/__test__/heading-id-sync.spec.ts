import '@testing-library/jest-dom/vitest'

import { defaultValueCtx, Editor, editorViewCtx } from '@milkdown/core'
import { expect, it } from 'vitest'

import { commonmark } from '..'
import { headingIdGenerator } from '../node/heading'

function createEditor(defaultValue: string, onGenerate: () => void) {
  return Editor.make()
    .config((ctx) => {
      ctx.set(defaultValueCtx, defaultValue)
      ctx.set(headingIdGenerator.key, (node) => {
        onGenerate()
        return node.textContent.toLowerCase().trim().replace(/\s+/g, '-')
      })
    })
    .use(commonmark)
}

function getHeadingIds(editor: Editor) {
  const view = editor.ctx.get(editorViewCtx)
  const ids: string[] = []

  view.state.doc.descendants((node) => {
    if (node.type.name === 'heading') ids.push(node.attrs.id)
  })

  return ids
}

it('should avoid regenerating heading ids for non-heading edits', async () => {
  let generated = 0
  const editor = createEditor('# Same\n\nparagraph\n\n# Same\n', () => {
    generated += 1
  })

  await editor.create()

  const view = editor.ctx.get(editorViewCtx)

  expect(generated).toBeGreaterThan(0)
  expect(getHeadingIds(editor)).toEqual(['same', 'same-#2'])

  generated = 0
  view.dispatch(view.state.tr.insertText(' edited', 9))

  expect(generated).toBe(0)
  expect(getHeadingIds(editor)).toEqual(['same', 'same-#2'])

  generated = 0
  view.dispatch(view.state.tr.insertText('changed', 2))

  expect(generated).toBeGreaterThan(0)
  expect(getHeadingIds(editor)).toEqual(['schangedame', 'same'])

  await editor.destroy()
})
