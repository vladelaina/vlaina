import '@testing-library/jest-dom/vitest'
import { Editor, editorViewCtx } from '@milkdown/core'
import { DOMParser as ProseDOMParser } from '@milkdown/prose/model'
import { expect, it } from 'vitest'

import { commonmark } from '@milkdown/preset-commonmark'

import { gfm } from '..'

function createEditor() {
  return Editor.make().use(commonmark).use(gfm)
}

it('should bound footnote DOM labels when parsing pasted HTML', async () => {
  const editor = createEditor()

  await editor.create()

  const view = editor.ctx.get(editorViewCtx)
  const container = document.createElement('div')
  container.innerHTML = [
    `<p>ref <sup data-type="footnote_reference" data-label="${'r'.repeat(600)}"></sup></p>`,
    `<dl data-type="footnote_definition" data-label="${'d'.repeat(600)}"><dt>label</dt><dd><p>note</p></dd></dl>`,
  ].join('')
  const doc = ProseDOMParser.fromSchema(view.state.schema).parse(container)
  let referenceLabel: unknown = null
  let definitionLabel: unknown = null

  doc.descendants((node) => {
    if (node.type.name === 'footnote_reference') referenceLabel = node.attrs.label
    if (node.type.name === 'footnote_definition') definitionLabel = node.attrs.label
  })

  expect(referenceLabel).toBe('')
  expect(definitionLabel).toBe('')

  await editor.destroy()
})
