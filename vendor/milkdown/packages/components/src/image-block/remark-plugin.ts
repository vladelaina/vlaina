import type { Node } from '@milkdown/transformer'

import { $remark } from '@milkdown/utils'

import { withMeta } from '../__internal__/meta'

const MAX_REMARK_IMAGE_BLOCK_DEPTH = 200
const MAX_REMARK_IMAGE_BLOCK_NODES = 20_000

function getChildren(node: Node): Node[] {
  const children = (node as Node & { children?: unknown }).children
  return Array.isArray(children) ? children as Node[] : []
}

function canTransformImageBlockAst(ast: Node): boolean {
  const stack: Array<{ depth: number; node: Node }> = [
    { depth: 0, node: ast },
  ]
  let visitedNodes = 0

  while (stack.length > 0) {
    const { depth, node } = stack.pop()!
    visitedNodes += 1
    if (visitedNodes > MAX_REMARK_IMAGE_BLOCK_NODES || depth > MAX_REMARK_IMAGE_BLOCK_DEPTH)
      return false

    const children = getChildren(node)
    for (let childIndex = children.length - 1; childIndex >= 0; childIndex -= 1) {
      stack.push({ depth: depth + 1, node: children[childIndex] })
    }
  }

  return true
}

export function visitImage(ast: Node) {
  if (!canTransformImageBlockAst(ast))
    return

  const stack: Array<{ index: number; node: Node; parent?: Node & { children: Node[] } }> = [
    { index: -1, node: ast },
  ]

  while (stack.length > 0) {
    const { index, node, parent } = stack.pop()!
    if (node.type === 'paragraph' && parent && index >= 0) {
      const children = getChildren(node)
      if (children.length !== 1)
        continue
      const firstChild = children[0]
      if (!firstChild || firstChild.type !== 'image')
        continue

      const { url, alt, title } = firstChild as Node & {
        url: string
        alt: string
        title: string
      }
      const newNode = {
        type: 'image-block',
        url,
        alt,
        title,
      }

      parent.children.splice(index, 1, newNode)
      continue
    }

    const children = getChildren(node)
    for (let childIndex = children.length - 1; childIndex >= 0; childIndex -= 1) {
      stack.push({
        index: childIndex,
        node: children[childIndex],
        parent: node as Node & { children: Node[] },
      })
    }
  }
}

export const remarkImageBlockPlugin = $remark(
  'remark-image-block',
  () => () => visitImage
)

withMeta(remarkImageBlockPlugin.plugin, {
  displayName: 'Remark<remarkImageBlock>',
  group: 'ImageBlock',
})

withMeta(remarkImageBlockPlugin.options, {
  displayName: 'RemarkConfig<remarkImageBlock>',
  group: 'ImageBlock',
})
