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

it('should normalize ordered list labels after converting an ordered-styled bullet list', async () => {
  const editor = createEditor()

  await editor.create()

  const view = editor.ctx.get(editorViewCtx)
  const { schema } = view.state
  const list = schema.nodes.bullet_list.create({ spread: false }, [
    schema.nodes.list_item.create(
      { label: '3.', listType: 'ordered', spread: true },
      [schema.nodes.paragraph.create(null, schema.text('three'))]
    ),
    schema.nodes.list_item.create(
      { label: '1.', listType: 'ordered', spread: true },
      [schema.nodes.paragraph.create(null, schema.text('four'))]
    ),
  ])

  view.dispatch(view.state.tr.replaceWith(0, view.state.doc.content.size, list))

  const normalizedList = view.state.doc.firstChild
  expect(normalizedList?.type.name).toBe('ordered_list')
  expect(normalizedList?.attrs.order).toBe(3)
  expect(normalizedList?.child(0).attrs.label).toBe('3.')
  expect(normalizedList?.child(1).attrs.label).toBe('4.')

  await editor.destroy()
})
