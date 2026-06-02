import '@testing-library/jest-dom/vitest'
import type { EditorView } from '@milkdown/prose/view'

import { defaultValueCtx, Editor, editorViewCtx } from '@milkdown/core'
import { expect, it } from 'vitest'

import { commonmark } from '..'
import { sanitizeGithubHtml } from '../node/github-html'

function createEditor() {
  const editor = Editor.make()
  editor.use(commonmark)
  return editor
}

const htmlInBlockquote = {
  name: 'htmlInBlockquote',
  defaultValue: `
> <p>Hello, world!</p>
`,
  check: (view: EditorView) => {
    expect(view.dom.querySelector('blockquote')).toBeInTheDocument()
  },
}

const htmlInListItem = {
  name: 'htmlInListItem',
  defaultValue: `
* <p>List item with HTML</p>
`,
  check: (view: EditorView) => {
    expect(view.dom.querySelector('li')).toBeInTheDocument()
  },
}

;[htmlInBlockquote, htmlInListItem].forEach(({ name, defaultValue, check }) => {
  it(`should render html in ${name}`, async () => {
    const editor = createEditor()
    editor.config((ctx) => {
      ctx.set(defaultValueCtx, defaultValue)
    })

    await editor.create()

    check(editor.ctx.get(editorViewCtx))
  })
})

it('should drop css escape and comment style obfuscation in github html', () => {
  const result = sanitizeGithubHtml([
    '<span style="color:red;',
    "background:image-set('https://example.test/image-set.png' 1x);",
    "background:-webkit-image-set('https://example.test/webkit-image-set.png' 1x);",
    'border:u\\72l(https://example.test/a.png);',
    'margin:u/**/rl(https://example.test/a.png);',
    'padding:exp\\72 ession(alert(1));',
    'font-weight:bold">x</span>',
  ].join(''))

  expect(result).toBe('<span style="color: red; font-weight: bold">x</span>')
  expect(result).not.toContain('example.test')
  expect(result).not.toContain('image-set')
  expect(result).not.toContain('expression')
})

it('should keep safe bare relative source srcset candidates in github html', () => {
  const result = sanitizeGithubHtml(
    '<picture><source srcset="safe.webp 1x, safe@2x.webp 2x"><img src="https://example.com/safe.png"></picture>',
  )

  expect(result).toContain('srcset="safe.webp 1x, safe@2x.webp 2x"')
})

it('should drop root-path raw media urls in github html', () => {
  const result = sanitizeGithubHtml([
    '<img src="/etc/passwd">',
    '<iframe src="/admin"></iframe>',
    '<video poster="/private.png"><source src="/private.mp4"></video>',
    '<img src="./images/safe.png">',
    '<img src="../images/safe.png">',
    '<img src="//example.com/safe.png">',
  ].join(''))

  expect(result).toBe('<img><img src="./images/safe.png"><img src="../images/safe.png"><img src="//example.com/safe.png">')
})

it('should drop protocol-relative links in github html', () => {
  const result = sanitizeGithubHtml('<a href="//example.com/path">protocol</a>')

  expect(result).toBe('<a>protocol</a>')
})

it('should render protocol-relative markdown links as text', async () => {
  const editor = createEditor()
  editor.config((ctx) => {
    ctx.set(defaultValueCtx, '[protocol](//example.com/path) [safe](https://example.com)')
  })

  await editor.create()

  const hrefs = Array.from(editor.ctx.get(editorViewCtx).dom.querySelectorAll('a')).map((anchor) => anchor.getAttribute('href'))
  expect(hrefs).toEqual(['https://example.com'])
  expect(editor.ctx.get(editorViewCtx).dom.textContent).toContain('protocol')

  await editor.destroy()
})
