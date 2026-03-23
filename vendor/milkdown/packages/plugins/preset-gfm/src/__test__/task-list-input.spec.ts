import '@testing-library/jest-dom/vitest'
import {
  Editor,
  defaultValueCtx,
  editorViewCtx,
  remarkStringifyOptionsCtx,
} from '@milkdown/core'
import type { EditorView } from '@milkdown/prose/view'
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

function createEditorWithContent(content: string) {
  const editor = Editor.make()
  editor
    .config((ctx) => {
      ctx.set(defaultValueCtx, content)
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

it.each([
  ['- [ ] todo', '- [ ] todo\n'],
  ['- 【 】 todo', '- [ ] todo\n'],
  ['- [ 】 todo', '- [ ] todo\n'],
  ['- 【 ] todo', '- [ ] todo\n'],
  ['- 【x】 done', '- [x] done\n'],
  ['- [x】 done', '- [x] done\n'],
  ['- 【x] done', '- [x] done\n'],
  ['- [X] done', '- [x] done\n'],
  ['- [✓] done', '- [x] done\n'],
])('should serialize %s as standard markdown', async (input, expected) => {
  const editor = createEditor()

  await editor.create()

  const view = editor.ctx.get(editorViewCtx)

  typeText(view, input)

  const markdown = editor.action(getMarkdown())
  expect(markdown).toBe(expected)
})

it.each([
  ['- [X] done', '- [x] done\n'],
  ['- [✓] done', '- [x] done\n'],
])('should parse %s and serialize back as standard markdown', async (input, expected) => {
  const editor = createEditorWithContent(input)

  await editor.create()

  const markdown = editor.action(getMarkdown())
  expect(markdown).toBe(expected)
})
