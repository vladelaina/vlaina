import { commandsCtx, defaultValueCtx, Editor, editorViewCtx, parserCtx } from '@milkdown/core'
import { NodeSelection, TextSelection } from '@milkdown/prose/state'
import type { EditorView } from '@milkdown/prose/view'
import { expect, it, vi, afterEach } from 'vitest'

import { commonmark } from '..'
import {
  isLocalNetworkHttpUrl,
  isPublicRemoteMediaUrl,
  sanitizeMediaSrc,
} from '../__internal__'
import { sanitizeLinkHref, toggleLinkCommand, updateLinkCommand } from '../mark/link'
import { insertImageCommand, sanitizeImageSrc, updateImageCommand } from '../node/image'

function createEditor(defaultValue = '') {
  const editor = Editor.make()
  editor.config((ctx) => {
    ctx.set(defaultValueCtx, defaultValue)
  })
  editor.use(commonmark)
  return editor
}

function findFirstImageInView(view: EditorView) {
  let image: { pos: number; src: string } | null = null
  view.state.doc.descendants((node, pos) => {
    if (node.type.name !== 'image') return true
    image = { pos, src: node.attrs.src }
    return false
  })
  return image
}

function findFirstLinkInView(view: EditorView) {
  let href: string | null = null
  view.state.doc.descendants((node) => {
    const link = node.marks.find((mark) => mark.type.name === 'link')
    if (!link) return true
    href = link.attrs.href
    return false
  })
  return href
}

afterEach(() => {
  vi.unstubAllGlobals()
})

it('blocks local-network media URLs without a browser window', () => {
  vi.stubGlobal('window', undefined)

  expect(isLocalNetworkHttpUrl('http://127.0.0.1:3000/image.png')).toBe(true)
  expect(isLocalNetworkHttpUrl('//127.0.0.1:3000/image.png')).toBe(true)
  expect(isLocalNetworkHttpUrl('http://localhost./image.png')).toBe(true)
  expect(isLocalNetworkHttpUrl('http://assets.localhost/image.png')).toBe(true)
  expect(isLocalNetworkHttpUrl('http://printer.local/image.png')).toBe(true)
  expect(isLocalNetworkHttpUrl('http://router/image.png')).toBe(true)
  expect(isLocalNetworkHttpUrl('http://100.64.0.1/image.png')).toBe(true)
  expect(isLocalNetworkHttpUrl('http://198.18.0.1/image.png')).toBe(true)
  expect(isLocalNetworkHttpUrl('http://[ff02::1]/image.png')).toBe(true)
  expect(isPublicRemoteMediaUrl('http://router/image.png')).toBe(false)
  expect(sanitizeMediaSrc('http://127.0.0.1:3000/image.png')).toBe(null)
  expect(sanitizeMediaSrc('//127.0.0.1:3000/image.png')).toBe(null)
  expect(sanitizeMediaSrc('http://assets.localhost/image.png')).toBe(null)
  expect(sanitizeMediaSrc('http://100.64.0.1/image.png')).toBe(null)
})

it('allows public media URLs without a browser window', () => {
  vi.stubGlobal('window', undefined)

  expect(isLocalNetworkHttpUrl('https://example.com/image.png')).toBe(false)
  expect(isLocalNetworkHttpUrl('https://100.128.0.1/image.png')).toBe(false)
  expect(isLocalNetworkHttpUrl('https://[2606:4700:4700::1111]/image.png')).toBe(false)
  expect(isPublicRemoteMediaUrl('https://example.com/image.png')).toBe(true)
  expect(isPublicRemoteMediaUrl('https://[2606:4700:4700::1111]/image.png')).toBe(true)
  expect(sanitizeMediaSrc('https://example.com/image.png')).toBe('https://example.com/image.png')
})

it('does not classify unsafe remote strings as public media URLs', () => {
  expect(isPublicRemoteMediaUrl('https://example.com/\u202Ecod.exe')).toBe(false)
  expect(isPublicRemoteMediaUrl('https://example.com/image.png\u0000')).toBe(false)
  expect(isPublicRemoteMediaUrl('//example.com/image.png\uFFFD')).toBe(false)
})

it('sanitizes image sources consistently for schema and component editors', () => {
  expect(sanitizeImageSrc('./assets/image.png')).toBe('./assets/image.png')
  expect(sanitizeImageSrc('', { allowEmpty: true })).toBe('')
  expect(sanitizeImageSrc('')).toBe(null)

  expect(sanitizeImageSrc('javascript:alert(1)')).toBe(null)
  expect(sanitizeImageSrc('data:image/svg+xml,<svg></svg>')).toBe(null)
  expect(sanitizeImageSrc('/etc/passwd')).toBe(null)
  expect(sanitizeImageSrc('C:\\Users\\secret.png')).toBe(null)
  expect(sanitizeImageSrc('http://127.0.0.1:3000/image.png')).toBe(null)
})

it('drops unsafe markdown image sources during parsing', async () => {
  const editor = createEditor(
    [
      '![local](http://127.0.0.1:3000/a.png)',
      '![script](javascript:alert(1))',
      '![safe](./assets/safe.png)',
    ].join('\n\n')
  )

  await editor.create()

  const doc = editor.ctx.get(parserCtx)(editor.ctx.get(defaultValueCtx))
  const sources: string[] = []
  doc.descendants((node) => {
    if (node.type.name === 'image') sources.push(node.attrs.src)
  })

  expect(sources).toEqual(['./assets/safe.png'])

  await editor.destroy()
})

it('does not create image nodes from unsafe image input rules', async () => {
  const editor = createEditor()

  await editor.create()

  const view = editor.ctx.get(editorViewCtx)
  for (const text of '![bad](javascript:alert(1))') {
    const { from, to } = view.state.selection
    let handled = false
    view.someProp('handleTextInput', (handleTextInput) => {
      handled = handleTextInput(view, from, to, text) || handled
    })
    if (!handled) view.dispatch(view.state.tr.insertText(text, from, to))
  }

  let hasImage = false
  view.state.doc.descendants((node) => {
    if (node.type.name === 'image') hasImage = true
  })

  expect(hasImage).toBe(false)

  await editor.destroy()
})

it('does not insert or update images with unsafe command sources', async () => {
  const editor = createEditor()

  await editor.create()

  const commands = editor.ctx.get(commandsCtx)
  const view = editor.ctx.get(editorViewCtx)

  expect(commands.call(insertImageCommand.key, { src: 'javascript:alert(1)' })).toBe(false)
  expect(findFirstImageInView(view)).toBe(null)

  expect(commands.call(insertImageCommand.key, { src: './assets/safe.png' })).toBe(true)
  const inserted = findFirstImageInView(view)
  expect(inserted?.src).toBe('./assets/safe.png')
  expect(inserted).not.toBe(null)

  view.dispatch(
    view.state.tr.setSelection(NodeSelection.create(view.state.doc, inserted!.pos))
  )
  expect(commands.call(updateImageCommand.key, { src: 'http://127.0.0.1/a.png' })).toBe(false)
  expect(findFirstImageInView(view)?.src).toBe('./assets/safe.png')

  await editor.destroy()
})

it('sanitizes link hrefs consistently for schema and component editors', () => {
  expect(sanitizeLinkHref('https://example.com/path')).toBe('https://example.com/path')
  expect(sanitizeLinkHref('mailto:user@example.com')).toBe('mailto:user@example.com')
  expect(sanitizeLinkHref('#heading')).toBe('#heading')
  expect(sanitizeLinkHref('../docs/readme.md')).toBe('../docs/readme.md')

  expect(sanitizeLinkHref('javascript:alert(1)')).toBe(null)
  expect(sanitizeLinkHref('data:text/html,alert(1)')).toBe(null)
  expect(sanitizeLinkHref('//example.com/path')).toBe(null)
  expect(sanitizeLinkHref('C:\\Users\\secret.txt')).toBe(null)
  expect(sanitizeLinkHref('https://example.com/\u202Ecod.exe')).toBe(null)
})

it('does not add or update links with unsafe command hrefs', async () => {
  const editor = createEditor('link')

  await editor.create()

  const commands = editor.ctx.get(commandsCtx)
  const view = editor.ctx.get(editorViewCtx)
  view.dispatch(
    view.state.tr.setSelection(TextSelection.create(view.state.doc, 1, 5))
  )

  expect(commands.call(toggleLinkCommand.key, { href: 'javascript:alert(1)' })).toBe(false)
  expect(findFirstLinkInView(view)).toBe(null)

  expect(commands.call(toggleLinkCommand.key, { href: './safe.md' })).toBe(true)
  expect(findFirstLinkInView(view)).toBe('./safe.md')

  expect(commands.call(updateLinkCommand.key, { href: 'data:text/html,alert(1)' })).toBe(false)
  expect(findFirstLinkInView(view)).toBe('./safe.md')

  await editor.destroy()
})
