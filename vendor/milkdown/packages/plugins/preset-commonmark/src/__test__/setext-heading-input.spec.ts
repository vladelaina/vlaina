import '@testing-library/jest-dom/vitest'
import { Editor, editorViewCtx } from '@milkdown/core'
import type { EditorView } from '@milkdown/prose/view'
import { getMarkdown } from '@milkdown/utils'
import { expect, it } from 'vitest'

import { commonmark } from '..'

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
    if (handled) return handled
    handled = handleKeyDown(view, event) || handled
    return handled
  })

  return handled
}

it.each([
  ['=', 1],
  ['-', 2],
] as const)('creates a level %s setext heading after Enter', async (marker, level) => {
  const editor = Editor.make().use(commonmark)
  await editor.create()

  const view = editor.ctx.get(editorViewCtx)
  typeText(view, 'Setext heading')
  pressEnter(view)
  typeText(view, marker.repeat(3))

  expect(pressEnter(view)).toBe(true)
  expect(view.state.doc.child(0).type.name).toBe('heading')
  expect(view.state.doc.child(0).attrs.level).toBe(level)
  expect(view.state.doc.child(0).textContent).toBe('Setext heading')
  expect(view.state.doc.child(1).type.name).toBe('paragraph')
  expect(editor.action(getMarkdown())).toContain(`${'#'.repeat(level)} Setext heading`)

  await editor.destroy()
})

it('keeps a standalone delimiter available to other Enter handlers', async () => {
  const editor = Editor.make().use(commonmark)
  await editor.create()

  const view = editor.ctx.get(editorViewCtx)
  typeText(view, '---')

  expect(view.state.doc.firstChild?.type.name).toBe('paragraph')
  expect(view.state.doc.firstChild?.textContent).toBe('---')

  await editor.destroy()
})

it('preserves inline marks from the source paragraph', async () => {
  const editor = Editor.make().use(commonmark)
  await editor.create()

  const view = editor.ctx.get(editorViewCtx)
  typeText(view, '**Marked heading**')
  pressEnter(view)
  typeText(view, '===')
  pressEnter(view)

  const heading = view.state.doc.child(0)
  expect(heading.type.name).toBe('heading')
  expect(heading.firstChild?.marks.some((mark) => mark.type.name === 'strong')).toBe(true)
  expect(editor.action(getMarkdown())).toContain('# **Marked heading**')

  await editor.destroy()
})

it('does not create a setext heading during IME composition', async () => {
  const editor = Editor.make().use(commonmark)
  await editor.create()

  const view = editor.ctx.get(editorViewCtx)
  typeText(view, 'Setext heading')
  pressEnter(view)
  typeText(view, '---')
  Object.defineProperty(view, 'composing', {
    configurable: true,
    value: true,
  })
  pressEnter(view)

  expect(view.state.doc.child(0).type.name).toBe('paragraph')
  expect(view.state.doc.child(1).type.name).toBe('paragraph')

  await editor.destroy()
})
