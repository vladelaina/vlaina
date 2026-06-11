import type { Node } from '@milkdown/transformer'

import { expect, it } from 'vitest'

import { transformRemarkMarkerTree } from '../plugin/remark-marker-plugin'

it('keeps emphasis and strong source markers when positions are available', () => {
  const source = '_em_ and **strong**'
  const tree = {
    type: 'root',
    children: [
      {
        type: 'paragraph',
        children: [
          {
            type: 'emphasis',
            position: { start: { offset: 0 } },
            children: [{ type: 'text', value: 'em' }],
          },
          {
            type: 'strong',
            position: { start: { offset: 9 } },
            children: [{ type: 'text', value: 'strong' }],
          },
        ],
      },
    ],
  } as Node & {
    children: Array<{
      children: Array<Node & { marker?: string }>
    }>
  }

  transformRemarkMarkerTree(tree, source)

  expect(tree.children[0].children[0].marker).toBe('_')
  expect(tree.children[0].children[1].marker).toBe('*')
})

it('skips marker preservation when remark nodes do not have source positions', () => {
  const emphasis = {
    type: 'emphasis',
    children: [{ type: 'text', value: 'em' }],
  } as Node & { marker?: string }
  const tree = {
    type: 'root',
    children: [
      {
        type: 'paragraph',
        children: [emphasis],
      },
    ],
  } as Node

  expect(() => transformRemarkMarkerTree(tree, '*em*')).not.toThrow()
  expect(emphasis.marker).toBeUndefined()
})
