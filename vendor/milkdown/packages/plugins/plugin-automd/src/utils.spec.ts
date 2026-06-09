import { expect, it, vi } from 'vitest'

import { MAX_AUTOMD_OFFSET_SCAN_NODES, calcOffset, swap } from './utils'

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

function atomNode(nodeSize = 1) {
  return {
    childCount: 0,
    isText: false,
    nodeSize,
    textContent: '',
  }
}

function protectedBranchNode(children: unknown[]) {
  return {
    child: (index: number) => children[index],
    childCount: children.length,
    isText: false,
    nodeSize: children.reduce(
      (size, child) => size + ((child as { nodeSize?: number }).nodeSize ?? 1),
      2
    ),
    get textContent() {
      throw new Error('aggregate node textContent should not be read')
    },
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

it('finds placeholder offsets without reading aggregate branch textContent', () => {
  const node = protectedBranchNode([
    textNode('abc'),
    protectedBranchNode([textNode('x∅y')]),
  ])

  expect(calcOffset(node as never, 10, '∅')).toBe(15)
})

it('skips non-text leaf nodes by node size when calculating placeholder offsets', () => {
  const node = branchNode([
    textNode('abc'),
    atomNode(1),
    textNode('x∅y'),
  ])

  expect(calcOffset(node as never, 10, '∅')).toBe(15)
})

it('caps offset scanning by node count', () => {
  const children = Array.from({ length: MAX_AUTOMD_OFFSET_SCAN_NODES + 1 }, () => textNode('a'))
  const node = {
    ...branchNode(children),
    child(index: number) {
      if (index >= MAX_AUTOMD_OFFSET_SCAN_NODES) {
        throw new Error('calcOffset should stop at the scan budget')
      }
      return children[index]
    },
  }

  expect(calcOffset(node as never, 10, '∅')).toBe(10 + MAX_AUTOMD_OFFSET_SCAN_NODES)
})
