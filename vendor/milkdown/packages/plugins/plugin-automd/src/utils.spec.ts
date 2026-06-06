import { expect, it, vi } from 'vitest'

import { calcOffset, swap } from './utils'

function textNode(text: string) {
  return {
    childCount: 0,
    isText: true,
    nodeSize: text.length,
    text,
    textContent: text,
  }
}

function branchNode(children: unknown[]) {
  return {
    child: (index: number) => children[index],
    childCount: children.length,
    isText: false,
    nodeSize: children.reduce(
      (size, child) => size + ((child as { nodeSize?: number }).nodeSize ?? 1),
      2
    ),
    textContent: children
      .map((child) => (child as { textContent?: string }).textContent ?? '')
      .join(''),
  }
}

it('swaps characters without splitting the full string', () => {
  let result = ''
  const split = vi.spyOn(String.prototype, 'split').mockImplementation(() => {
    throw new Error('swap should not split the full string')
  })

  try {
    result = swap('abc', 0, 2)
  } finally {
    split.mockRestore()
  }

  expect(result).toBe('cba')
})

it('stops offset scanning after the placeholder is found', () => {
  const children = [
    textNode('abc'),
    branchNode([textNode('x∅y')]),
    textNode('unreachable'),
  ]
  const node = branchNode(children)
  const child = vi.spyOn(node, 'child').mockImplementation((index: number) => {
    if (index > 1) {
      throw new Error('calcOffset should stop after finding the placeholder')
    }
    return children[index]
  })

  expect(calcOffset(node as never, 10, '∅')).toBe(15)
  expect(child).toHaveBeenCalledTimes(2)
})
