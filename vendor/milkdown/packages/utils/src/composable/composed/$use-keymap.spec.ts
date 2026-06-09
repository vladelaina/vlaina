import { defaultValueCtx, Editor, editorViewCtx } from '@milkdown/core'
import { expect, test, vi } from 'vitest'

import { $nodeSchema } from './$node-schema'
import { $useKeymap } from './$use-keymap'

const docSchema = $nodeSchema('doc', () => ({
  content: 'block*',
  parseMarkdown: {
    match: ({ type }) => type === 'root',
    runner: (state, node, type) => {
      state.injectRoot(node, type)
    },
  },
  toMarkdown: {
    match: (node) => node.type.name === 'doc',
    runner: () => {},
  },
}))

const textSchema = $nodeSchema('text', () => ({
  group: 'inline',
  parseMarkdown: {
    match: ({ type }) => type === 'text',
    runner: () => {},
  },
  toMarkdown: {
    match: (node) => node.type.name === 'text',
    runner: () => {},
  },
}))

const paragraphSchema = $nodeSchema('paragraph', () => ({
  content: 'inline*',
  group: 'block',
  parseDOM: [{ tag: 'p' }],
  toDOM: () => ['p', 0],
  parseMarkdown: {
    match: (node) => node.type === 'paragraph',
    runner: (state, node, type) => {
      state.openNode(type).next(node.children).closeNode()
    },
  },
  toMarkdown: {
    match: (node) => node.type.name === 'paragraph',
    runner: () => {},
  },
}))

test('keeps duplicate shortcut bindings ordered by priority', async () => {
  const highPriority = vi.fn()
  const lowPriority = vi.fn()
  const keymap = $useKeymap('duplicateShortcutKeymap', {
    HighPriorityEnter: {
      shortcuts: 'Enter',
      priority: 100,
      command: () => () => {
        highPriority()
        return true
      },
    },
    LowPriorityEnter: {
      shortcuts: 'Enter',
      priority: 1,
      command: () => () => {
        lowPriority()
        return true
      },
    },
  })

  const editor = await Editor.make()
    .config((ctx) => {
      ctx.set(defaultValueCtx, '')
    })
    .use(docSchema)
    .use(paragraphSchema)
    .use(textSchema)
    .use(keymap)
    .create()

  const view = editor.ctx.get(editorViewCtx)
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
  expect(highPriority).toHaveBeenCalledTimes(1)
  expect(lowPriority).not.toHaveBeenCalled()

  await editor.destroy()
})
