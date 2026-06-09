import type { Node } from '@milkdown/kit/transformer'

import { describe, expect, it } from 'vitest'

import { visitMathBlock } from './remark'

function createDeepMathTree(depth: number): { leaf: Node; tree: Node } {
  const leaf = {
    type: 'math',
    value: 'x = y',
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

describe('remark math block', () => {
  it('turns math blocks into LaTeX code blocks', () => {
    const tree = {
      type: 'root',
      children: [
        {
          type: 'math',
          value: 'x = y',
        },
      ],
    } as Node

    visitMathBlock(tree)

    expect((tree as Node & { children: Node[] }).children[0]).toEqual({
      type: 'code',
      lang: 'LaTeX',
      value: 'x = y',
    })
  })

  it('stops before transforming over-deep math blocks', () => {
    const { leaf, tree } = createDeepMathTree(201)

    visitMathBlock(tree)

    expect(leaf.type).toBe('math')
  })

  it('skips the whole tree when the math AST is over budget', () => {
    const { tree } = createDeepMathTree(201)
    const shallowMath = {
      type: 'math',
      value: 'a = b',
    } as Node
    ;(tree as Node & { children: Node[] }).children.unshift(shallowMath)

    visitMathBlock(tree)

    expect((tree as Node & { children: Node[] }).children[0]).toBe(shallowMath)
  })
})
