import type { Node } from '@milkdown/transformer'

import { $remark } from '@milkdown/utils'
import { visit } from 'unist-util-visit'

import { withMeta } from '../__internal__'
import { countRemarkAstNodes, MAX_REMARK_AST_NODES } from './remark-ast-budget'

export function transformRemarkLineBreakTree(tree: Node): void {
  const initialNodeCount = countRemarkAstNodes(tree)
  if (initialNodeCount === null) return

  let remainingNodeBudget = MAX_REMARK_AST_NODES - initialNodeCount
  const find = /[\t ]*(?:\r?\n|\r)/g
  visit(
    tree,
    'text',
    (
      node: Node & { value: string },
      index: number,
      parent: Node & { children: Node[] }
    ) => {
      if (!node.value || typeof node.value !== 'string') return

      const result = []
      let start = 0
      let exceededNodeBudget = false
      const pushResult = (next: Node) => {
        result.push(next)
        if (result.length - 1 > remainingNodeBudget)
          exceededNodeBudget = true
      }

      find.lastIndex = 0

      let match = find.exec(node.value)

      while (match) {
        const position = match.index

        if (start !== position)
          pushResult({
            type: 'text',
            value: node.value.slice(start, position),
          })

        pushResult({ type: 'break', data: { isInline: true } })
        if (exceededNodeBudget) return

        start = position + match[0].length
        match = find.exec(node.value)
      }

      const hasResultAndIndex =
        result.length > 0 && parent && typeof index === 'number'

      if (!hasResultAndIndex) return

      if (start < node.value.length)
        pushResult({ type: 'text', value: node.value.slice(start) })

      const addedNodes = result.length - 1
      if (addedNodes > remainingNodeBudget)
        return

      remainingNodeBudget -= addedNodes
      parent.children.splice(index, 1, ...result)
      return index + result.length
    }
  )
}

/// This plugin is used to add inline line break for remark AST.
/// The inline line break should be treated as a `space`.
/// And the normal line break should be treated as a `LF`.
export const remarkLineBreak = $remark(
  'remarkLineBreak',
  () => () => transformRemarkLineBreakTree
)

withMeta(remarkLineBreak.plugin, {
  displayName: 'Remark<remarkLineBreak>',
  group: 'Remark',
})

withMeta(remarkLineBreak.options, {
  displayName: 'RemarkConfig<remarkLineBreak>',
  group: 'Remark',
})
