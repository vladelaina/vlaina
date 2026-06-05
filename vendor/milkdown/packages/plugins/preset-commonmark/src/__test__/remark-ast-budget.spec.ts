import type { Node } from '@milkdown/transformer'

import { expect, it } from 'vitest'

import { canTransformRemarkAst } from '../plugin/remark-ast-budget'

function createDeepTree(depth: number): Node {
  let current: Node = { type: 'text', value: 'leaf' }

  for (let index = 0; index < depth; index += 1) {
    current = {
      type: 'container',
      children: [current],
    } as Node
  }

  return current
}

it('allows ordinary remark ASTs', () => {
  expect(canTransformRemarkAst({
    type: 'root',
    children: [
      {
        type: 'paragraph',
        children: [{ type: 'text', value: 'hello' }],
      },
    ],
  } as Node)).toBe(true)
})

it('rejects over-deep remark ASTs without recursive traversal', () => {
  expect(canTransformRemarkAst(createDeepTree(201))).toBe(false)
})

it('rejects over-large remark ASTs', () => {
  expect(canTransformRemarkAst({
    type: 'root',
    children: Array.from({ length: 20_001 }, (_, index) => ({
      type: 'text',
      value: String(index),
    })),
  } as Node)).toBe(false)
})
