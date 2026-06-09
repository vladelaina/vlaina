import '@testing-library/jest-dom/vitest'
import type { EditorView } from '@milkdown/prose/view'

import { Editor, editorViewCtx, remarkStringifyOptionsCtx } from '@milkdown/core'
import { commonmark } from '@milkdown/preset-commonmark'
import { TextSelection } from '@milkdown/prose/state'
import { getMarkdown } from '@milkdown/utils'
import { expect, it, vi } from 'vitest'

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

function pressKey(view: EditorView, key: string) {
  const event = new KeyboardEvent('keydown', {
    key,
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

it('should create a pipe table without reading aggregate paragraph textContent', async () => {
  const editor = createEditor()

  await editor.create()

  const view = editor.ctx.get(editorViewCtx)

  typeText(view, '|1|2|')
  const paragraph = view.state.selection.$from.parent
  const textBetween = vi.spyOn(paragraph, 'textBetween')
  Object.defineProperty(paragraph, 'textContent', {
    configurable: true,
    get() {
      throw new Error('aggregate paragraph textContent should not be read')
    },
  })

  pressEnter(view)

  expect(view.state.doc.firstChild?.type.name).toBe('table')
  expect(textBetween).toHaveBeenCalledWith(0, paragraph.content.size, '', '')
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

it('should not continue strikethrough input rule formatting for following text', async () => {
  const editor = createEditor()

  await editor.create()

  const view = editor.ctx.get(editorViewCtx)

  typeText(view, '~~s~~x')

  const markdown = editor.action(getMarkdown())
  expect(markdown).toBe('~~s~~x\n')
})

it.each(['Backspace', 'Delete'])(
  'should not keep strikethrough after deleting the only input-rule text with %s',
  async (key) => {
    const editor = createEditor()

    await editor.create()

    const view = editor.ctx.get(editorViewCtx)
    typeText(view, '~~2~~')
    if (key === 'Delete') {
      view.dispatch(
        view.state.tr.setSelection(TextSelection.create(view.state.doc, 1))
      )
    }

    pressKey(view, key)
    typeText(view, 'x')

    const markdown = editor.action(getMarkdown())
    expect(markdown).toBe('x\n')
  }
)
