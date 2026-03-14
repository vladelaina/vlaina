import '@testing-library/jest-dom/vitest'
import type { EditorView } from '@milkdown/prose/view'

import { defaultValueCtx, Editor, editorViewCtx } from '@milkdown/core'
import { getMarkdown } from '@milkdown/utils'
import { expect, it } from 'vitest'

import { commonmark } from '..'

function createEditor(defaultValue?: string) {
  const editor = Editor.make()
  if (defaultValue != null) {
    editor.config((ctx) => {
      ctx.set(defaultValueCtx, defaultValue)
    })
  }
  editor.use(commonmark)
  return editor
}

function typeText(view: EditorView, input: string) {
  for (const text of input) {
    const { from, to } = view.state.selection
    let handled = false

    view.someProp('handleTextInput', (handleTextInput) => {
      handled = handleTextInput(view, from, to, text) || handled
    })

    if (!handled) view.dispatch(view.state.tr.insertText(text, from, to))
  }
}

it.each(['2. hello', '２. hello', '2． hello', '２． hello'])(
  'should preserve ordered list start when created from input rule: %s',
  async (input) => {
    const editor = createEditor()

    await editor.create()

    const view = editor.ctx.get(editorViewCtx)

    typeText(view, input)

    expect(view.state.doc.firstChild?.attrs.order).toBe(2)

    const markdown = editor.action(getMarkdown())
    expect(markdown).toBe('2. hello\n')
  }
)

it('should preserve ordered list start when loading markdown', async () => {
  const editor = createEditor('2. hello\n')

  await editor.create()

  const view = editor.ctx.get(editorViewCtx)

  expect(view.state.doc.firstChild?.attrs.order).toBe(2)

  const markdown = editor.action(getMarkdown())
  expect(markdown).toBe('2. hello\n')
})
