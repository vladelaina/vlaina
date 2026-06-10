import { describe, expect, it } from 'vitest'

import type { MarkdownNode } from '../utility'

import {
  MAX_INLINE_HTML_MERGE_CHILDREN,
  MAX_INLINE_HTML_MERGE_DEPTH,
  mergePairedInlineHtml,
} from './html'

function createPositionedInlineNodes(
  markdown: string,
  parts: Array<{ type: string; value?: string; children?: MarkdownNode[]; source?: string }>
): MarkdownNode[] {
  let offset = 0
  return parts.map((part) => {
    const source = part.source ?? part.value
    const start = markdown.indexOf(source, offset)
    if (start < 0) throw new Error(`Missing markdown part: ${source}`)
    offset = start + source.length
    return {
      ...part,
      position: {
        start: { offset: start },
        end: { offset },
      },
    } as MarkdownNode
  })
}

function createTree(
  markdown: string,
  parts: Array<{ type: string; value?: string; children?: MarkdownNode[]; source?: string }>
): MarkdownNode {
  return {
    type: 'root',
    children: [
      {
        type: 'paragraph',
        children: createPositionedInlineNodes(markdown, parts),
      } as MarkdownNode,
    ],
  } as MarkdownNode
}

function createBlockTree(
  markdown: string,
  parts: Array<{ type: string; value?: string; children?: MarkdownNode[]; source?: string }>
): MarkdownNode {
  return {
    type: 'root',
    children: createPositionedInlineNodes(markdown, parts),
  } as MarkdownNode
}

function paragraphChildren(tree: MarkdownNode): MarkdownNode[] {
  return tree.children?.[0]?.children ?? []
}

describe('mergePairedInlineHtml', () => {
  it('restores raw source for paired containers with nested html nodes', () => {
    const markdown = '<span style="color : #123456"><em>nested</em></span> <mark style="background-color : #ecf6ff"><strong>bold</strong></mark>'
    const tree = createTree(markdown, [
      { type: 'html', value: '<span style="color : #123456">' },
      { type: 'html', value: '<em>' },
      { type: 'text', value: 'nested' },
      { type: 'html', value: '</em>' },
      { type: 'html', value: '</span>' },
      { type: 'text', value: ' ' },
      { type: 'html', value: '<mark style="background-color : #ecf6ff">' },
      { type: 'html', value: '<strong>' },
      { type: 'text', value: 'bold' },
      { type: 'html', value: '</strong>' },
      { type: 'html', value: '</mark>' },
    ])

    const result = mergePairedInlineHtml(tree, markdown)

    expect(paragraphChildren(result).map((node) => ({ type: node.type, value: node.value }))).toEqual([
      { type: 'html', value: '<span style="color : #123456"><em>nested</em></span>' },
      { type: 'text', value: ' ' },
      { type: 'html', value: '<mark style="background-color : #ecf6ff"><strong>bold</strong></mark>' },
    ])
  })

  it('restores raw source for paired containers with entity-encoded nested html text', () => {
    const markdown = '<span style="color : #123456"><em>nested</em></span>'
    const tree = createTree(markdown, [
      { type: 'html', value: '<span style="color : #123456">' },
      { type: 'text', value: '&lt;em&gt;nested&lt;/em&gt;', source: '<em>nested</em>' },
      { type: 'html', value: '</span>' },
    ])

    const result = mergePairedInlineHtml(tree, markdown)

    expect(paragraphChildren(result).map((node) => ({ type: node.type, value: node.value }))).toEqual([
      { type: 'html', value: markdown },
    ])
  })

  it('restores single html nodes from source when their value has encoded nested tags', () => {
    const markdown = '<span style="color : #123456"><em>nested</em></span>'
    const tree = createTree(markdown, [
      {
        type: 'html',
        value: '<span style="color : #123456">&lt;em&gt;nested&lt;/em&gt;</span>',
        source: markdown,
      },
    ])

    const result = mergePairedInlineHtml(tree, markdown)

    expect(paragraphChildren(result).map((node) => ({ type: node.type, value: node.value }))).toEqual([
      { type: 'html', value: markdown },
    ])
  })

  it('pairs same-tag nested inline html by nesting depth', () => {
    const markdown = '<span style="color : #123456"><span style="font-weight : 600">nested</span></span>'
    const tree = createTree(markdown, [
      { type: 'html', value: '<span style="color : #123456">' },
      { type: 'html', value: '<span style="font-weight : 600">' },
      { type: 'text', value: 'nested' },
      { type: 'html', value: '</span>' },
      { type: 'html', value: '</span>' },
    ])

    const result = mergePairedInlineHtml(tree, markdown)

    expect(paragraphChildren(result).map((node) => ({ type: node.type, value: node.value }))).toEqual([
      { type: 'html', value: markdown },
    ])
  })

  it('restores raw source for search listed-tag html blocks with inline markdown text', () => {
    const markdown = '<search>Find *literal emphasis markers*\n</search>'
    const tree = createTree(markdown, [
      { type: 'html', value: '<search>' },
      { type: 'text', value: 'Find ' },
      {
        type: 'emphasis',
        children: [{ type: 'text', value: 'literal emphasis markers' }] as MarkdownNode[],
        source: '*literal emphasis markers*',
      },
      { type: 'text', value: '\n' },
      { type: 'html', value: '</search>' },
    ])

    const result = mergePairedInlineHtml(tree, markdown)

    expect(result).toMatchObject({
      type: 'root',
      children: [
        {
          type: 'html',
          value: markdown,
          githubHtmlBlock: true,
        },
      ],
    })
  })

  it('restores raw source for paired block html split by markdown blank lines', () => {
    const markdown = '<div>\nAlpha\n\nBeta\n</div>'
    const tree = createBlockTree(markdown, [
      { type: 'html', value: '<div>\nAlpha' },
      {
        type: 'paragraph',
        children: [{ type: 'text', value: 'Beta' }] as MarkdownNode[],
        source: 'Beta',
      },
      { type: 'html', value: '</div>' },
    ])

    const result = mergePairedInlineHtml(tree, markdown)

    expect(result).toMatchObject({
      type: 'root',
      children: [
        {
          type: 'html',
          value: markdown,
          githubHtmlBlock: true,
        },
      ],
    })
  })

  it('does not repeatedly scan all siblings for unmatched open tags', () => {
    let stringReads = 0
    const children = Array.from({ length: 400 }, () => ({
      type: 'html',
      value: {
        toString() {
          stringReads += 1
          return '<span>'
        },
      },
    })) as MarkdownNode[]
    const tree = {
      type: 'paragraph',
      children,
    } as MarkdownNode

    const result = mergePairedInlineHtml(tree)

    expect(result.children).toHaveLength(children.length)
    expect(stringReads).toBeLessThanOrEqual(children.length * 2)
  })

  it('skips paired inline html merging when child count exceeds the merge budget', () => {
    const children = Array.from({ length: MAX_INLINE_HTML_MERGE_CHILDREN + 1 }, (_, index) => ({
      type: index === 0 || index === MAX_INLINE_HTML_MERGE_CHILDREN ? 'html' : 'text',
      value: index === 0 ? '<span style="color : #123456">' : index === MAX_INLINE_HTML_MERGE_CHILDREN ? '</span>' : 'x',
    })) as MarkdownNode[]
    const tree = {
      type: 'paragraph',
      children,
    } as MarkdownNode

    const result = mergePairedInlineHtml(tree)

    expect(result.children).toHaveLength(children.length)
    expect(result.children?.[0]).toBe(children[0])
    expect(result.children?.[MAX_INLINE_HTML_MERGE_CHILDREN]).toBe(children[MAX_INLINE_HTML_MERGE_CHILDREN])
  })

  it('stops descending after the inline html merge depth budget', () => {
    const leaf = {
      type: 'paragraph',
      children: [
        { type: 'html', value: '<span style="color : #123456">' },
        { type: 'strong', children: [{ type: 'text', value: 'nested' }] as MarkdownNode[] },
        { type: 'html', value: '</span>' },
      ],
    } as MarkdownNode
    let node = leaf
    for (let depth = 0; depth <= MAX_INLINE_HTML_MERGE_DEPTH; depth += 1) {
      node = {
        type: 'container',
        children: [node],
      } as MarkdownNode
    }

    expect(() => mergePairedInlineHtml(node)).not.toThrow()
    expect(leaf.children).toHaveLength(3)
  })
})
