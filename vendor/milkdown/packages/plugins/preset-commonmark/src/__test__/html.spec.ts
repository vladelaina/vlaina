import '@testing-library/jest-dom/vitest'
import type { EditorView } from '@milkdown/prose/view'

import { defaultValueCtx, Editor, editorViewCtx } from '@milkdown/core'
import { afterEach, expect, it, vi } from 'vitest'

import { commonmark } from '..'
import { isGithubHtmlBlock, maxGithubHtmlSanitizeChars, sanitizeGithubHtml } from '../node/github-html'

function createEditor() {
  const editor = Editor.make()
  editor.use(commonmark)
  return editor
}

afterEach(() => {
  vi.restoreAllMocks()
})

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

it('should keep media with sanitized source src without querying the subtree', () => {
  const querySelector = vi.spyOn(Element.prototype, 'querySelector')
  const result = sanitizeGithubHtml('<audio><source src="https://example.com/safe.mp3"></audio>')

  expect(result).toBe('<audio><source src="https://example.com/safe.mp3"></audio>')
  expect(querySelector).not.toHaveBeenCalled()
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

it('should classify search listed-tag html blocks with inline text as github html blocks', () => {
  expect(isGithubHtmlBlock('<search>Find *literal emphasis markers*\n</search>')).toBe(true)
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

it('should drop internal relative media paths in github html', () => {
  const result = sanitizeGithubHtml([
    '<img src=".vlaina/private.png">',
    '<img src="docs/.GIT/private.png">',
    '<img src="%2evlaina/private.png">',
    '<video poster="docs/%252egit/private.png"><source src=".vlaina/private.mp4"></video>',
    '<source srcset=".vlaina/private.webp 1x, safe.webp 2x">',
    '<img src=".notes/safe.png">',
    '<source srcset=".notes/safe.webp 1x">',
  ].join(''))

  expect(result).toBe('<img><img><img><source><img src=".notes/safe.png"><source srcset=".notes/safe.webp 1x">')
  expect(result).not.toContain('.vlaina')
  expect(result).not.toContain('.GIT')
  expect(result).not.toContain('%2evlaina')
  expect(result).not.toContain('%252egit')
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

it('should drop internal relative link paths in github html', () => {
  const result = sanitizeGithubHtml([
    '<a href=".vlaina/workspace.md">vlaina</a>',
    '<a href="./.vlaina/workspace.md">nested vlaina</a>',
    '<a href="docs/.git/config.md">git</a>',
    '<a href="docs/%252egit/config.md">encoded git</a>',
    '<blockquote cite=".vlaina/source.md">quote</blockquote>',
    '<q cite="docs/.GIT/source.md">inline quote</q>',
    '<a href=".notes/public.md">notes</a>',
    '<blockquote cite=".notes/source.md">safe quote</blockquote>',
  ].join(''))

  expect(result).toBe([
    '<a>vlaina</a>',
    '<a>nested vlaina</a>',
    '<a>git</a>',
    '<a>encoded git</a>',
    '<blockquote>quote</blockquote>',
    '<q>inline quote</q>',
    '<a href=".notes/public.md">notes</a>',
    '<blockquote cite=".notes/source.md">safe quote</blockquote>',
  ].join(''))
  expect(result).not.toContain('.vlaina')
  expect(result).not.toContain('.git')
  expect(result).not.toContain('%252egit')
})

it('should drop parser-promoted descendants from sanitizer-only remove-content raw html tags', () => {
  const result = sanitizeGithubHtml([
    '<svg><img src="https://example.com/svg.png"></svg>',
    '<math><img src="https://example.com/math.png"></math>',
    '<noscript><img src="https://example.com/noscript.png"></noscript>',
    '<img src="https://example.com/real.png">',
  ].join(''))

  expect(result).toBe('<img src="https://example.com/real.png">')
})

it('should drop parser-promoted raw html siblings while creating editor document', async () => {
  const editor = createEditor()
  editor.config((ctx) => {
    ctx.set(defaultValueCtx, [
      '<svg>',
      '<img src="https://example.com/svg.png">',
      '</svg>',
      '<img src="https://example.com/real.png">',
    ].join('\n\n'))
  })

  await editor.create()

  const srcs = Array.from(editor.ctx.get(editorViewCtx).dom.querySelectorAll('img'))
    .map((image) => image.getAttribute('src'))
    .filter((src): src is string => Boolean(src))
  expect(srcs).toEqual(['https://example.com/real.png'])
  expect(editor.ctx.get(editorViewCtx).dom.innerHTML).not.toContain('https://example.com/svg.png')

  await editor.destroy()
})

it('should keep nested parser-promoted raw html containers active while creating editor document', async () => {
  const editor = createEditor()
  editor.config((ctx) => {
    ctx.set(defaultValueCtx, [
      '<svg><svg><img src="https://example.com/hidden.png"></svg>',
      '<img src="https://example.com/leaked.png"></svg>',
      '<img src="https://example.com/real.png">',
    ].join('\n\n'))
  })

  await editor.create()

  const srcs = Array.from(editor.ctx.get(editorViewCtx).dom.querySelectorAll('img'))
    .map((image) => image.getAttribute('src'))
    .filter((src): src is string => Boolean(src))
  expect(srcs).toEqual(['https://example.com/real.png'])
  expect(editor.ctx.get(editorViewCtx).dom.innerHTML).not.toContain('hidden.png')
  expect(editor.ctx.get(editorViewCtx).dom.innerHTML).not.toContain('leaked.png')

  await editor.destroy()
})

it('should ignore raw html close tags inside comments while creating editor document', async () => {
  const editor = createEditor()
  editor.config((ctx) => {
    ctx.set(defaultValueCtx, [
      '<svg>',
      '<!-- </svg> -->',
      '<img src="https://example.com/leaked.png">',
      '</svg>',
      '<img src="https://example.com/real.png">',
    ].join('\n\n'))
  })

  await editor.create()

  const srcs = Array.from(editor.ctx.get(editorViewCtx).dom.querySelectorAll('img'))
    .map((image) => image.getAttribute('src'))
    .filter((src): src is string => Boolean(src))
  expect(srcs).toEqual(['https://example.com/real.png'])
  expect(editor.ctx.get(editorViewCtx).dom.innerHTML).not.toContain('leaked.png')

  await editor.destroy()
})

it('should keep malformed parser-promoted raw html containers active while creating editor document', async () => {
  const editor = createEditor()
  editor.config((ctx) => {
    ctx.set(defaultValueCtx, [
      '<svg <img src="https://example.com/hidden.png">',
      '<img src="https://example.com/leaked.png">',
      '</svg>',
      '<img src="https://example.com/real.png">',
    ].join('\n\n'))
  })

  await editor.create()

  const srcs = Array.from(editor.ctx.get(editorViewCtx).dom.querySelectorAll('img'))
    .map((image) => image.getAttribute('src'))
    .filter((src): src is string => Boolean(src))
  expect(srcs).toEqual(['https://example.com/real.png'])
  expect(editor.ctx.get(editorViewCtx).dom.innerHTML).not.toContain('hidden.png')
  expect(editor.ctx.get(editorViewCtx).dom.innerHTML).not.toContain('leaked.png')

  await editor.destroy()
})

it('should cap deeply nested github html during sanitization', () => {
  const payload = `${'<div>'.repeat(250)}<p onclick="evil()">deep</p>${'</div>'.repeat(250)}`

  const result = sanitizeGithubHtml(payload)

  expect(result).not.toContain('onclick')
  expect(result).not.toContain('evil()')
})

it('should cap github html node counts during sanitization', () => {
  const payload = Array.from({ length: 20_050 }, (_, index) =>
    `<span onclick="evil(${index})">x</span>`,
  ).join('')

  const result = sanitizeGithubHtml(payload)
  const template = document.createElement('template')
  template.innerHTML = result

  expect(template.content.querySelectorAll('span')).toHaveLength(10_000)
  expect(result).not.toContain('onclick')
})

it('should drop oversized github html attribute values before expensive parsing', () => {
  const oversized = 'x'.repeat(16 * 1024 + 1)
  const manySrcsetCandidates = Array.from({ length: 129 }, (_, index) => `safe-${index}.webp 1x`).join(', ')
  const result = sanitizeGithubHtml([
    `<span style="${oversized}">text</span>`,
    `<a href="${oversized}">link</a>`,
    `<img src="https://example.com/a.png" alt="${oversized}">`,
    `<source srcset="${manySrcsetCandidates}">`,
    `<iframe src="https://example.com/embed" sandbox="${oversized}"></iframe>`,
  ].join(''))
  const template = document.createElement('template')
  template.innerHTML = result

  expect(template.content.querySelector('span')?.hasAttribute('style')).toBe(false)
  expect(template.content.querySelector('a')?.hasAttribute('href')).toBe(false)
  expect(template.content.querySelector('img')?.hasAttribute('alt')).toBe(false)
  expect(template.content.querySelector('source')?.hasAttribute('srcset')).toBe(false)
  expect(template.content.querySelector('iframe')?.getAttribute('sandbox')).toBe('allow-scripts')
  expect(result).not.toContain(oversized)
})

it('should skip oversized github html before DOM parsing', () => {
  const payload = `${'x'.repeat(2 * 1024 * 1024 + 1)}<img src="https://example.com/a.png">`

  expect(sanitizeGithubHtml(payload)).toBe('')
})

it('should not write oversized raw html into editor data attributes', async () => {
  const editor = createEditor()
  const oversizedHtml = `<img alt="${'x'.repeat(maxGithubHtmlSanitizeChars + 1)}">`
  editor.config((ctx) => {
    ctx.set(defaultValueCtx, oversizedHtml)
  })

  await editor.create()

  const htmlNode = editor.ctx.get(editorViewCtx).dom.querySelector('[data-type="html"]')
  expect(htmlNode).toBeInTheDocument()
  expect(htmlNode?.getAttribute('data-value')).toBe('')
  expect(editor.ctx.get(editorViewCtx).dom.innerHTML).not.toContain('x'.repeat(1024))

  await editor.destroy()
})

it('should keep GFM-disallowed raw html as escaped source text', () => {
  const result = sanitizeGithubHtml([
    '<noembed><img src="https://example.com/noembed.png"></noembed>',
    '<noframes><img src="https://example.com/noframes.png"></noframes>',
    '<plaintext><img src="https://example.com/plaintext.png"></plaintext>',
    '<img src="https://example.com/hidden-after-plaintext.png">',
  ].join(''))

  expect(result).toContain('&lt;noembed&gt;&lt;img src="https://example.com/noembed.png"&gt;&lt;/noembed&gt;')
  expect(result).toContain('&lt;noframes&gt;&lt;img src="https://example.com/noframes.png"&gt;&lt;/noframes&gt;')
  expect(result).toContain('&lt;plaintext&gt;&lt;img src="https://example.com/plaintext.png"&gt;&lt;/plaintext&gt;')
  expect(result).toContain('&lt;img src="https://example.com/hidden-after-plaintext.png"&gt;')
  expect(result).not.toContain('<img src="https://example.com/noembed.png">')
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
