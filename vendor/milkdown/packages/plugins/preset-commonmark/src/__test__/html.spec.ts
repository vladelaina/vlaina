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

it('should reject unsafe source srcset descriptors in github html', () => {
  const result = sanitizeGithubHtml([
    '<source srcset="images/descriptor-script.webp 1x javascript:alert(1)">',
    '<source srcset="images/invalid-descriptor.webp invalid-descriptor">',
    '<source srcset="images/safe.webp 1x">',
  ].join(''))

  expect(result).toBe('<source><source><source srcset="images/safe.webp 1x">')
  expect(result).not.toContain('javascript:')
  expect(result).not.toContain('invalid-descriptor')
})

it('should reject scheme-bearing media urls even when plain relatives are allowed', () => {
  const result = sanitizeGithubHtml([
    '<img src="blob:https://example.com/image">',
    '<img src="data:image/png;base64,QUJDRA==">',
    '<img src="mailto:user@example.com">',
    '<img src="images/safe.png">',
    '<source srcset="blob:https://example.com/image 1x">',
    '<source srcset="images/safe.webp 1x">',
  ].join(''))

  expect(result).toBe('<img><img><img><img src="images/safe.png"><source><source srcset="images/safe.webp 1x">')
  expect(result).not.toContain('blob:')
  expect(result).not.toContain('data:')
  expect(result).not.toContain('mailto:')
})

it('should drop root-path raw media urls in github html', () => {
  const result = sanitizeGithubHtml([
    '<img src="/etc/passwd">',
    '<iframe src="/admin"></iframe>',
    '<video poster="/private.png"><source src="/private.mp4"></video>',
    String.raw`<img src="http:\127.0.0.1\secret.png">`,
    String.raw`<img src="\\127.0.0.1\secret.png">`,
    '<img src="./images/safe.png">',
    '<img src="../images/safe.png">',
    '<img src="//example.com/safe.png">',
    '<iframe src="//example.com/embed"></iframe>',
    '<video src="//example.com/demo.mp4"></video>',
  ].join(''))

  expect(result).toBe('<img><img><img><img src="./images/safe.png"><img src="../images/safe.png"><img src="https://example.com/safe.png"><iframe src="https://example.com/embed" sandbox="allow-scripts" referrerpolicy="no-referrer"></iframe><video src="https://example.com/demo.mp4"></video>')
})

it('should drop protocol-relative links in github html', () => {
  const result = sanitizeGithubHtml('<a href="//example.com/path">protocol</a>')

  expect(result).toBe('<a>protocol</a>')
})

it('should keep plain relative links in github html', () => {
  const result = sanitizeGithubHtml([
    '<a href="readme.md">readme</a>',
    '<a href="docs/readme.md">docs</a>',
    '<a href="/docs/readme.md">root</a>',
    '<img src="/etc/passwd">',
  ].join(''))

  expect(result).toBe('<a href="readme.md">readme</a><a href="docs/readme.md">docs</a><a href="/docs/readme.md">root</a><img>')
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
