import type { Node } from '@milkdown/transformer'

import { $remark } from '@milkdown/utils'
import { visit } from 'unist-util-visit'

import { withMeta } from '../__internal__'
import { canTransformRemarkAst } from './remark-ast-budget'

function getMarker(node: Node, source: string): string | null {
  const offset = node.position?.start.offset
  if (
    typeof offset !== 'number' ||
    !Number.isSafeInteger(offset) ||
    offset < 0 ||
    offset >= source.length
  )
    return null

  const marker = source.charAt(offset)
  return marker === '*' || marker === '_' ? marker : null
}

export function transformRemarkMarkerTree(tree: Node, source: string): void {
  if (!canTransformRemarkAst(tree)) return

  visit(
    tree,
    (node: Node) => ['strong', 'emphasis'].includes(node.type),
    (node: Node) => {
      const marker = getMarker(node, source)
      if (!marker) return
      ;(node as Node & { marker: string }).marker = marker
    }
  )
}

/// This plugin is used to keep the marker (`_` and `*`) of emphasis and strong nodes.
export const remarkMarker = $remark(
  'remarkMarker',
  () => () => (tree, file) => {
    transformRemarkMarkerTree(tree, String(file.value ?? ''))
  }
)

withMeta(remarkMarker.plugin, {
  displayName: 'Remark<remarkMarker>',
  group: 'Remark',
})

withMeta(remarkMarker.options, {
  displayName: 'RemarkConfig<remarkMarker>',
  group: 'Remark',
})
