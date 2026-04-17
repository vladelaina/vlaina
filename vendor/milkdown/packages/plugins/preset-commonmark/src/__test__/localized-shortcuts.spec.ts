import '@testing-library/jest-dom/vitest'
import type { EditorView } from '@milkdown/prose/view'

import {
  Editor,
  editorViewCtx,
  remarkStringifyOptionsCtx,
} from '@milkdown/core'
import { getMarkdown } from '@milkdown/utils'
import { expect, it } from 'vitest'

import { commonmark } from '..'

function createEditor() {
  const editor = Editor.make()
  editor
    .config((ctx) => {
      ctx.update(remarkStringifyOptionsCtx, (prev) => ({
        ...prev,
        bullet: '-',
        rule: '-',
        ruleRepetition: 3,
      }))
    })
    .use(commonmark)
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

it('should serialize fullwidth heading marker as standard markdown', async () => {
  const editor = createEditor()

  await editor.create()

  const view = editor.ctx.get(editorViewCtx)

  typeText(view, '＃ 标题')

  const markdown = editor.action(getMarkdown())
  expect(markdown).toBe('# 标题\n')
})

it('should keep fullwidth thematic break marker as plain text without an Enter shortcut', async () => {
  const editor = createEditor()

  await editor.create()

  const view = editor.ctx.get(editorViewCtx)

  typeText(view, '－－－ ')

  expect(view.state.doc.firstChild?.type.name).toBe('paragraph')
  expect(view.state.doc.firstChild?.textContent).toBe('－－－ ')
})

it('should create code block from fullwidth fence marker', async () => {
  const editor = createEditor()

  await editor.create()

  const view = editor.ctx.get(editorViewCtx)

  typeText(view, '···ts ')

  expect(view.state.doc.firstChild?.type.name).toBe('code_block')
  expect(view.state.doc.firstChild?.attrs.language).toBe('ts')
})

it('should serialize fullwidth bullet list marker as standard markdown', async () => {
  const editor = createEditor()

  await editor.create()

  const view = editor.ctx.get(editorViewCtx)

  typeText(view, '－ 列表项')

  const markdown = editor.action(getMarkdown())
  expect(markdown).toBe('- 列表项\n')
})

it('should serialize localized image markdown as standard markdown', async () => {
  const editor = createEditor()

  await editor.create()

  const view = editor.ctx.get(editorViewCtx)

  typeText(view, '！【猫】（/cat.png）')

  const markdown = editor.action(getMarkdown())
  expect(markdown).toBe('![猫](/cat.png)\n')
})

it('should serialize fullwidth emphasis marker as standard markdown', async () => {
  const editor = createEditor()

  await editor.create()

  const view = editor.ctx.get(editorViewCtx)

  typeText(view, '＊斜体＊')

  const markdown = editor.action(getMarkdown())
  expect(markdown).toBe('*斜体*\n')
})

it('should serialize fullwidth strong marker as standard markdown', async () => {
  const editor = createEditor()

  await editor.create()

  const view = editor.ctx.get(editorViewCtx)

  typeText(view, '＊＊粗体＊＊')

  const markdown = editor.action(getMarkdown())
  expect(markdown).toBe('**粗体**\n')
})
