import type { Node } from '@milkdown/transformer'

import { expect, it } from 'vitest'

import { MAX_REMARK_AST_NODES } from '../plugin/remark-ast-budget'
import { transformRemarkLineBreakTree } from '../plugin/remark-line-break'

function createTextTree(value: string): Node & { children: Array<Node & { children: Node[] }> } {
  return {
    type: 'root',
    children: [{
      type: 'paragraph',
      children: [{ type: 'text', value }],
    }],
  } as Node & { children: Array<Node & { children: Node[] }> }
}

it('splits ordinary inline line breaks into break nodes', () => {
  const tree = createTextTree('alpha\nbeta')

  transformRemarkLineBreakTree(tree)

  expect(tree.children[0].children).toEqual([
    { type: 'text', value: 'alpha' },
    { type: 'break', data: { isInline: true } },
    { type: 'text', value: 'beta' },
  ])
})

it('skips line break splitting when it would exceed the remark AST node budget', () => {
  const value = Array.from({ length: MAX_REMARK_AST_NODES }, () => 'line').join('\n')
  const tree = createTextTree(value)

  transformRemarkLineBreakTree(tree)

  expect(tree.children[0].children).toEqual([{ type: 'text', value }])
})
