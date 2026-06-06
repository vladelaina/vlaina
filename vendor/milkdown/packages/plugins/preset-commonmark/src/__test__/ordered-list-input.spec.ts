import '@testing-library/jest-dom/vitest'
import type { EditorView } from '@milkdown/prose/view'

import { defaultValueCtx, Editor, editorViewCtx } from '@milkdown/core'
import { getMarkdown } from '@milkdown/utils'
import { expect, it, vi } from 'vitest'

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

it('should skip ordered list label synchronization for non-list edits', async () => {
  const editor = createEditor('plain text')

  await editor.create()

  const view = editor.ctx.get(editorViewCtx)
  const tr = view.state.tr.insertText('!', 1)
  const descendants = vi.spyOn(tr.doc, 'descendants').mockImplementation(() => {
    throw new Error('Document descendants should not be scanned')
  })
  const result = view.state.applyTransaction(tr)

  expect(result.transactions).toHaveLength(1)
  expect(descendants).not.toHaveBeenCalled()

  await editor.destroy()
})

it('should synchronize ordered list labels without scanning the whole document', async () => {
  const editor = createEditor('1. one\n2. two\n\nparagraph\n\n1. far\n2. away')

  await editor.create()

  const view = editor.ctx.get(editorViewCtx)
  let secondItemPos = -1
  view.state.doc.descendants((node, pos, parent, index) => {
    if (
      secondItemPos === -1 &&
      node.type.name === 'list_item' &&
      parent?.type.name === 'ordered_list' &&
      index === 1
    ) {
      secondItemPos = pos
      return false
    }
    return secondItemPos === -1
  })
  expect(secondItemPos).toBeGreaterThan(-1)

  const listItem = view.state.doc.nodeAt(secondItemPos)
  expect(listItem).not.toBeNull()
  const tr = view.state.tr.setNodeMarkup(secondItemPos, undefined, {
    ...listItem!.attrs,
    label: '99.',
  })
  const descendants = vi.spyOn(tr.doc, 'descendants').mockImplementation(() => {
    throw new Error('Document descendants should not be scanned')
  })
  const result = view.state.applyTransaction(tr)

  expect(result.transactions).toHaveLength(2)
  expect(result.state.doc.nodeAt(secondItemPos)?.attrs.label).toBe('2.')
  expect(descendants).not.toHaveBeenCalled()

  await editor.destroy()
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
