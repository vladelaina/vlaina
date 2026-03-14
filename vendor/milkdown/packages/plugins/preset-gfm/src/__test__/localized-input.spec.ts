import '@testing-library/jest-dom/vitest'
import type { EditorView } from '@milkdown/prose/view'

import { Editor, editorViewCtx, remarkStringifyOptionsCtx } from '@milkdown/core'
import { commonmark } from '@milkdown/preset-commonmark'
import { getMarkdown } from '@milkdown/utils'
import { expect, it } from 'vitest'

import { gfm } from '..'

function createEditor() {
  const editor = Editor.make()
  editor
    .config((ctx) => {
      ctx.update(remarkStringifyOptionsCtx, (prev) => ({
        ...prev,
        bullet: '-',
      }))
    })
    .use(commonmark)
    .use(gfm)
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

function pressEnter(view: EditorView) {
  const event = new KeyboardEvent('keydown', {
    key: 'Enter',
    bubbles: true,
    cancelable: true,
  })
  let handled = false

  view.someProp('handleKeyDown', (handleKeyDown) => {
    handled = handleKeyDown(view, event) || handled
  })

  expect(handled).toBe(true)
}

it('should create table from localized table shortcut', async () => {
  const editor = createEditor()

  await editor.create()

  const view = editor.ctx.get(editorViewCtx)

  typeText(view, '｜２×２｜ ')

  expect(view.state.doc.firstChild?.type.name).toBe('table')
})

it('should create a 2x2 table from a two-cell pipe row on enter', async () => {
  const editor = createEditor()

  await editor.create()

  const view = editor.ctx.get(editorViewCtx)

  typeText(view, '|1|2|')
  pressEnter(view)

  expect(view.state.doc.firstChild?.type.name).toBe('table')
  expect(view.state.doc.firstChild?.childCount).toBe(2)
  expect(view.state.doc.firstChild?.firstChild?.childCount).toBe(2)
})

it('should create a 3x2 table from a three-cell pipe row on enter', async () => {
  const editor = createEditor()

  await editor.create()

  const view = editor.ctx.get(editorViewCtx)

  typeText(view, '|1|2|3|')
  pressEnter(view)

  expect(view.state.doc.firstChild?.type.name).toBe('table')
  expect(view.state.doc.firstChild?.childCount).toBe(2)
  expect(view.state.doc.firstChild?.firstChild?.childCount).toBe(3)
})

it('should serialize fullwidth strikethrough marker as standard markdown', async () => {
  const editor = createEditor()

  await editor.create()

  const view = editor.ctx.get(editorViewCtx)

  typeText(view, '～～删除～～')

  const markdown = editor.action(getMarkdown())
  expect(markdown).toBe('~~删除~~\n')
})
