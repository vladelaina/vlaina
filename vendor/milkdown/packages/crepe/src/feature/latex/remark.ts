import type { Node } from '@milkdown/kit/transformer'

import { $remark } from '@milkdown/kit/utils'
import remarkMath from 'remark-math'

const MAX_REMARK_MATH_BLOCK_DEPTH = 200
const MAX_REMARK_MATH_BLOCK_NODES = 20_000

export const remarkMathPlugin = $remark<'remarkMath', undefined>(
  'remarkMath',
  () => remarkMath
)

function getChildren(node: Node): Node[] {
  const children = (node as Node & { children?: unknown }).children
  return Array.isArray(children) ? children as Node[] : []
}

function canTransformMathBlockAst(ast: Node): boolean {
  const stack: Array<{ depth: number; node: Node }> = [
    { depth: 0, node: ast },
  ]
  let visitedNodes = 0

  while (stack.length > 0) {
    const { depth, node } = stack.pop()!
    visitedNodes += 1
    if (visitedNodes > MAX_REMARK_MATH_BLOCK_NODES || depth > MAX_REMARK_MATH_BLOCK_DEPTH)
      return false

    const children = getChildren(node)
    for (let childIndex = children.length - 1; childIndex >= 0; childIndex -= 1) {
      stack.push({ depth: depth + 1, node: children[childIndex] })
    }
  }

  return true
}

export function visitMathBlock(ast: Node) {
  if (!canTransformMathBlockAst(ast))
    return

  const stack: Array<{ index: number; node: Node; parent?: Node & { children: Node[] } }> = [
    { index: -1, node: ast },
  ]

  while (stack.length > 0) {
    const { index, node, parent } = stack.pop()!
    if (node.type === 'math' && parent && index >= 0) {
      const { value } = node as Node & { value: string }
      const newNode = {
        type: 'code',
        lang: 'LaTeX',
        value,
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

/// Turn math block into code block with language LaTeX.
export const remarkMathBlockPlugin = $remark(
  'remarkMathBlock',
  () => () => visitMathBlock
)
