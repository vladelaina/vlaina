import '@testing-library/jest-dom/vitest'
import { Editor, editorViewCtx } from '@milkdown/core'
import type { EditorView } from '@milkdown/prose/view'
import { getMarkdown } from '@milkdown/utils'
import { expect, it } from 'vitest'

import { commonmark } from '..'

function createEditor() {
  const editor = Editor.make()
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

function pressBackspace(view: EditorView) {
  const event = new KeyboardEvent('keydown', {
    key: 'Backspace',
    bubbles: true,
    cancelable: true,
  })
  let handled = false

  view.someProp('handleKeyDown', (handleKeyDown) => {
    handled = handleKeyDown(view, event) || handled
  })

  expect(handled).toBe(true)
}

it('should treat fullwidth quote marker as blockquote input and serialize to standard markdown', async () => {
  const editor = createEditor()

  await editor.create()

  const view = editor.ctx.get(editorViewCtx)

  typeText(view, '》 hello')

  const markdown = editor.action(getMarkdown())
  expect(markdown).toBe('> hello\n')
})

it.each(['>', '》'])(
  'should turn empty blockquote created from %s back into an empty paragraph',
  async (marker) => {
    const editor = createEditor()

    await editor.create()

    const view = editor.ctx.get(editorViewCtx)

    typeText(view, `${marker} `)
    pressBackspace(view)

    expect(view.state.doc.childCount).toBe(1)
    expect(view.state.doc.firstChild?.type.name).toBe('paragraph')

    const markdown = editor.action(getMarkdown())
    expect(markdown).toBe('')
  }
)
