import { describe, expect, it } from 'vitest'

import type { MarkdownNode } from '../utility'

import { mergePairedInlineHtml } from './html'

function createPositionedInlineNodes(
  markdown: string,
  parts: Array<{ type: string; value: string; source?: string }>
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

function createTree(markdown: string, parts: Array<{ type: string; value: string; source?: string }>): MarkdownNode {
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
})
