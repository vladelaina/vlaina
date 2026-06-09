import type { Node } from '@milkdown/transformer'

import { describe, expect, it } from 'vitest'

import { visitImage } from './remark-plugin'

function createDeepImageTree(depth: number): { leaf: Node; tree: Node } {
  const leaf = {
    type: 'paragraph',
    children: [{
      type: 'image',
      url: 'asset://demo.png',
      alt: 'demo',
      title: 'Demo',
    }],
  } as Node
  let current = leaf

  for (let index = 0; index < depth; index += 1) {
    current = {
      type: 'container',
      children: [current],
    } as Node
  }

  return {
    leaf,
    tree: {
      type: 'root',
      children: [current],
    } as Node,
  }
}

describe('remark image block', () => {
  it('turns single-image paragraphs into image blocks', () => {
    const tree = {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [{
            type: 'image',
            url: 'asset://demo.png',
            alt: 'demo',
            title: 'Demo',
          }],
        },
      ],
    } as Node

    visitImage(tree)

    expect((tree as Node & { children: Node[] }).children[0]).toEqual({
      type: 'image-block',
      url: 'asset://demo.png',
      alt: 'demo',
      title: 'Demo',
    })
  })

  it('stops before transforming over-deep image paragraphs', () => {
    const { leaf, tree } = createDeepImageTree(201)

    visitImage(tree)

    expect(leaf.type).toBe('paragraph')
  })

  it('skips the whole tree when the image AST is over budget', () => {
    const { tree } = createDeepImageTree(201)
    const shallowImage = {
      type: 'paragraph',
      children: [{
        type: 'image',
        url: 'asset://shallow.png',
        alt: 'shallow',
        title: 'Shallow',
      }],
    } as Node
    ;(tree as Node & { children: Node[] }).children.unshift(shallowImage)

    visitImage(tree)

    expect((tree as Node & { children: Node[] }).children[0]).toBe(shallowImage)
  })
})
