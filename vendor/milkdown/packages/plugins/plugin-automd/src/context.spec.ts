import { expect, it, vi } from 'vitest'

import {
  collectAutomdGlobalNodes,
  normalizeAutomdGeneratedNode,
  splitFirstMarkdownBlock,
} from './context'

function fakeNode(
  typeName: string,
  children: any[] = [],
  attrs: Record<string, unknown> = {}
) {
  return {
    attrs,
    child: (index: number) => children[index],
    childCount: children.length,
    marks: [],
    nodeSize: children.reduce((size, child) => size + (child.nodeSize ?? 1), 2),
    textContent: children.map((child) => child.textContent ?? '').join(''),
    type: { name: typeName },
  }
}

function fakeText(
  text: string,
  marks: Array<{ attrs: Record<string, string>; type: { name: string } }> = []
) {
  return {
    childCount: 0,
    marks,
    nodeSize: text.length,
    text,
    textContent: text,
    type: { name: 'text' },
  }
}

it('extracts the first markdown block without splitting the full string', () => {
  const split = vi.spyOn(String.prototype, 'split').mockImplementation(() => {
    throw new Error('splitFirstMarkdownBlock should not split the full string')
  })

  try {
    expect(splitFirstMarkdownBlock('first\n\nsecond\n\nthird')).toEqual({
      firstBlock: 'first',
      rest: '\n\nsecond\n\nthird',
    })
    expect(splitFirstMarkdownBlock('first')).toEqual({
      firstBlock: 'first',
      rest: '',
    })
  } finally {
    split.mockRestore()
  }
})

it('collects automd global nodes without descending into matched nodes', () => {
  const nested = fakeNode('footnote_definition', [
    fakeNode('paragraph', [fakeText('unreachable')]),
  ])
  const doc = fakeNode('doc', [
    fakeNode('paragraph', [fakeText('body')]),
    nested,
  ])

  expect(collectAutomdGlobalNodes(doc as never, ['footnote_definition'])).toEqual({
    complete: true,
    nodes: [nested],
  })
})

it('caps automd global node scans by node count', () => {
  let accessed = 0
  const children = [
    fakeNode('paragraph'),
    fakeNode('paragraph'),
    fakeNode('footnote_definition'),
  ]
  const doc = {
    ...fakeNode('doc', children),
    child(index: number) {
      accessed += 1
      return children[index]
    },
  }

  const result = collectAutomdGlobalNodes(doc as never, ['footnote_definition'], 2)

  expect(result.complete).toBe(false)
  expect(result.nodes).toEqual([])
  expect(accessed).toBe(2)
})

it('normalizes generated automd links and escaped marker holders', () => {
  const linkMark = {
    attrs: { href: 'https://example.com/∴' },
    type: { name: 'link' },
  }
  const text = fakeText('\u200B＊ and \u200B⎽ ∴', [linkMark])
  const doc = fakeNode('paragraph', [text])

  expect(normalizeAutomdGeneratedNode(doc as never, '∴')).toBe(true)
  expect(linkMark.attrs.href).toBe('https://example.com/')
  expect(text.text).toBe('\u200B* and \u200B_ ∴')
})

it('caps generated automd node normalization scans by node count', () => {
  let accessed = 0
  const children = [
    fakeText('plain'),
    fakeText('later \u200B＊'),
  ]
  const doc = {
    ...fakeNode('paragraph', children),
    child(index: number) {
      accessed += 1
      return children[index]
    },
  }

  expect(normalizeAutomdGeneratedNode(doc as never, '∴', 1)).toBe(false)
  expect(children[1]!.text).toBe('later \u200B＊')
  expect(accessed).toBe(1)
})
