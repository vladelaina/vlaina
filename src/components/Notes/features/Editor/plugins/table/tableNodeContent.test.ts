import { describe, expect, it } from 'vitest'

import {
  isTableContentNodeEmpty,
  type TableContentNodeLike,
} from '../../../../../../../vendor/milkdown/packages/components/src/table-block/view/table-node-content'

function createNode(args: {
  name: string
  children?: TableContentNodeLike[]
  isLeaf?: boolean
  isText?: boolean
  text?: string | null
}): TableContentNodeLike {
  const children = args.children ?? []

  return {
    child: (index: number) => children[index],
    childCount: children.length,
    isLeaf: args.isLeaf ?? false,
    isText: args.isText ?? false,
    text: args.text,
    type: {
      name: args.name,
    },
  }
}

describe('table node content', () => {
  it('treats whitespace-only text content as empty', () => {
    const cell = createNode({
      name: 'table_cell',
      children: [
        createNode({
          name: 'paragraph',
          children: [createNode({ name: 'text', isLeaf: true, isText: true, text: '   ' })],
        }),
      ],
    })

    expect(isTableContentNodeEmpty(cell)).toBe(true)
  })

  it('treats non-text leaf content as non-empty', () => {
    const cell = createNode({
      name: 'table_cell',
      children: [
        createNode({
          name: 'paragraph',
          children: [createNode({ name: 'image', isLeaf: true })],
        }),
      ],
    })

    expect(isTableContentNodeEmpty(cell)).toBe(false)
  })

  it('ignores hard breaks when determining emptiness', () => {
    const cell = createNode({
      name: 'table_cell',
      children: [
        createNode({
          name: 'paragraph',
          children: [createNode({ name: 'hard_break', isLeaf: true })],
        }),
      ],
    })

    expect(isTableContentNodeEmpty(cell)).toBe(true)
  })

  it('treats nested textual content as non-empty', () => {
    const cell = createNode({
      name: 'table_cell',
      children: [
        createNode({
          name: 'paragraph',
          children: [
            createNode({
              name: 'strong',
              children: [createNode({ name: 'text', isLeaf: true, isText: true, text: 'value' })],
            }),
          ],
        }),
      ],
    })

    expect(isTableContentNodeEmpty(cell)).toBe(false)
  })
})
