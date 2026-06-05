import type { Node } from '@milkdown/transformer'

const MAX_REMARK_AST_DEPTH = 200
const MAX_REMARK_AST_NODES = 20_000

function getChildren(node: Node): Node[] {
  const children = (node as Node & { children?: unknown }).children
  return Array.isArray(children) ? children as Node[] : []
}

export function canTransformRemarkAst(tree: Node): boolean {
  const stack = [{ depth: 0, node: tree }]
  let nodes = 0

  while (stack.length > 0) {
    const { depth, node } = stack.pop()!
    nodes += 1
    if (nodes > MAX_REMARK_AST_NODES || depth > MAX_REMARK_AST_DEPTH)
      return false

    const children = getChildren(node)
    for (let index = children.length - 1; index >= 0; index -= 1) {
      stack.push({ depth: depth + 1, node: children[index] })
    }
  }

  return true
}
