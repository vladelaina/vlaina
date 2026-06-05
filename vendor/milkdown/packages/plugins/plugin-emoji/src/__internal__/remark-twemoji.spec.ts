import type { Node } from '@milkdown/transformer'

import { describe, expect, it } from 'vitest'

import { twemojiPlugin } from './remark-twemoji'

function createDeepTree(leaf: Node): Node {
  let current = leaf
  for (let index = 0; index < 205; index += 1) {
    current = {
      type: 'container',
      children: [current],
    } as Node
  }
  return {
    type: 'root',
    children: [current],
  } as Node
}

describe('twemojiPlugin', () => {
  it('converts ordinary emoji literals', () => {
    const tree = {
      type: 'root',
      children: [{ type: 'text', value: 'Hello 😀' }],
    } as Node

    twemojiPlugin({})(tree)

    expect(JSON.stringify(tree)).toContain('"type":"emoji"')
  })

  it('skips over-budget trees before recursive traversal', () => {
    const tree = createDeepTree({ type: 'text', value: '😀' })

    twemojiPlugin({})(tree)

    expect(JSON.stringify(tree)).not.toContain('"type":"emoji"')
  })

  it('skips over-large sibling lists before scheduling every child', () => {
    const tree = {
      type: 'root',
      children: Array.from({ length: 20_001 }, () => ({ type: 'text', value: '😀' })),
    } as Node

    twemojiPlugin({})(tree)

    expect(JSON.stringify(tree)).not.toContain('"type":"emoji"')
  })
})
