import '@testing-library/jest-dom/vitest'
import type { EditorView } from '@milkdown/prose/view'

import {
  defaultValueCtx,
  Editor,
  editorViewCtx,
  remarkStringifyOptionsCtx,
} from '@milkdown/core'
import { getMarkdown } from '@milkdown/utils'
import { TextSelection } from '@milkdown/prose/state'
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

function pressKey(view: EditorView, key: string) {
  const handled = triggerKey(view, key)

  expect(handled).toBe(true)
}

function triggerKey(view: EditorView, key: string) {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
  })
  let handled = false

  view.someProp('handleKeyDown', (handleKeyDown) => {
    handled = handleKeyDown(view, event) || handled
  })

  return handled
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

  typeText(view, '！【猫】（./cat.png）')

  const markdown = editor.action(getMarkdown())
  expect(markdown).toBe('![猫](./cat.png)\n')
})

it('should serialize fullwidth emphasis marker as standard markdown', async () => {
  const editor = createEditor()

  await editor.create()

  const view = editor.ctx.get(editorViewCtx)

  typeText(view, '＊斜体＊')

  const markdown = editor.action(getMarkdown())
  expect(markdown).toBe('*斜体*\n')
})

it.each([
  ['*s*x', '*s*x\n'],
  ['_s_x', '_s_x\n'],
  ['**s**x', '**s**x\n'],
  ['__s__x', '__s__x\n'],
])(
  'should not continue markdown mark input rule formatting for following text: %s',
  async (input, expected) => {
    const editor = createEditor()

    await editor.create()

    const view = editor.ctx.get(editorViewCtx)

    typeText(view, input)

    const markdown = editor.action(getMarkdown())
    expect(markdown).toBe(expected)
  }
)

it.each(['Backspace', 'Delete'])(
  'should not preserve bold after deleting a selected bold range with %s',
  async (key) => {
    const editor = createEditor()
    editor.config((ctx) => {
      ctx.set(defaultValueCtx, '**bold**')
    })

    await editor.create()

    const view = editor.ctx.get(editorViewCtx)
    view.dispatch(
      view.state.tr.setSelection(TextSelection.create(view.state.doc, 1, 5))
    )

    pressKey(view, key)
    typeText(view, 'x')

    const markdown = editor.action(getMarkdown())
    expect(markdown).toBe('x\n')
  }
)

it.each([
  ['strong', '**2**', '**x**\n'],
  ['emphasis', '*2*', '*x*\n'],
  ['inline code', '`2`', '`x`\n'],
] as const)(
  'should not keep %s after deleting the only input-rule text with Backspace',
  async (_name, input, internalExpected) => {
    const editor = createEditor()

    await editor.create()

    const view = editor.ctx.get(editorViewCtx)
    typeText(view, input)

    pressKey(view, 'Backspace')
    typeText(view, 'x')

    const markdown = editor.action(getMarkdown())
    expect(markdown).not.toBe(internalExpected)
    expect(markdown).toBe('x\n')
  }
)

it.each([
  ['strong', '**2**', '**x**\n'],
  ['emphasis', '*2*', '*x*\n'],
  ['inline code', '`2`', '`x`\n'],
] as const)(
  'should not keep %s after deleting the only input-rule text with Delete',
  async (_name, input, internalExpected) => {
    const editor = createEditor()

    await editor.create()

    const view = editor.ctx.get(editorViewCtx)
    typeText(view, input)
    view.dispatch(
      view.state.tr.setSelection(TextSelection.create(view.state.doc, 1))
    )

    pressKey(view, 'Delete')
    typeText(view, 'x')

    const markdown = editor.action(getMarkdown())
    expect(markdown).not.toBe(internalExpected)
    expect(markdown).toBe('x\n')
  }
)

it('should keep bold when deleting inside an existing bold range', async () => {
  const editor = createEditor()
  editor.config((ctx) => {
    ctx.set(defaultValueCtx, '**bold**')
  })

  await editor.create()

  const view = editor.ctx.get(editorViewCtx)
  view.dispatch(
    view.state.tr.setSelection(TextSelection.create(view.state.doc, 2, 4))
  )

  pressKey(view, 'Backspace')
  typeText(view, 'x')

  const markdown = editor.action(getMarkdown())
  expect(markdown).toBe('**bxd**\n')
})

it('should not keep bold after deleting a just-created bold input rule with Backspace', async () => {
  const editor = createEditor()

  await editor.create()

  const view = editor.ctx.get(editorViewCtx)
  typeText(view, '**2**')

  expect(view.state.doc.textContent).toBe('2')
  expect(
    view.state.doc.rangeHasMark(1, 2, view.state.schema.marks.strong)
  ).toBe(true)

  pressKey(view, 'Backspace')
  typeText(view, 'x')

  const markdown = editor.action(getMarkdown())
  expect(markdown).toBe('x\n')
})

it('should not keep bold after deleting a just-created bold input rule with Delete', async () => {
  const editor = createEditor()

  await editor.create()

  const view = editor.ctx.get(editorViewCtx)
  typeText(view, '**2**')

  view.dispatch(
    view.state.tr.setSelection(TextSelection.create(view.state.doc, 1))
  )

  pressKey(view, 'Delete')
  typeText(view, 'x')

  const markdown = editor.action(getMarkdown())
  expect(markdown).toBe('x\n')
})

it('should serialize fullwidth strong marker as standard markdown', async () => {
  const editor = createEditor()

  await editor.create()

  const view = editor.ctx.get(editorViewCtx)

  typeText(view, '＊＊粗体＊＊')

  const markdown = editor.action(getMarkdown())
  expect(markdown).toBe('**粗体**\n')
})
