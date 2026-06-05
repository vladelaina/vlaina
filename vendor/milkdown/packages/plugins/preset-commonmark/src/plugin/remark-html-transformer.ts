import type { Node } from '@milkdown/transformer'

import { $remark } from '@milkdown/utils'

import { withMeta } from '../__internal__'
import {
  gfmDisallowedRawHtmlTags,
  sanitizerOnlyDropWithContentTags,
} from '../node/github-html'
import { prepareGithubRawHtmlForSanitizerFragment } from '../node/github-raw-html'

const isParent = (node: Node): node is Node & { children: Node[] } =>
  !!(node as Node & { children: Node[] }).children
const isHTML = (
  node: Node
): node is Node & { children: Node[]; value: unknown } => node.type === 'html'

interface RawHtmlState {
  activeDepth: number
  activeMode: 'drop' | 'escape' | null
  activeTag: string | null
}

function flatMapWithDepth(
  ast: Node,
  fn: (node: Node, index: number, parent: Node | null) => Node[]
) {
  const rawHtmlState: RawHtmlState = {
    activeDepth: 1,
    activeMode: null,
    activeTag: null,
  }

  return transform(ast, 0, null)[0]

  function transform(node: Node, index: number, parent: Node | null) {
    if (isHTML(node) && typeof node.value === 'string') {
      const sanitized = sanitizeRawHtmlNode(node, rawHtmlState)
      const out = []
      for (let i = 0, n = sanitized.length; i < n; i++) {
        const item = sanitized[i]
        if (!item) continue
        const xs = fn(item, index, parent)
        for (let j = 0, m = xs.length; j < m; j++) {
          const mapped = xs[j]
          if (mapped) out.push(mapped)
        }
      }
      return out
    }

    const enteredDroppedRawHtml = rawHtmlState.activeTag && rawHtmlState.activeMode === 'drop'
    if (isParent(node)) {
      const out = []
      for (let i = 0, n = node.children.length; i < n; i++) {
        const nthChild = node.children[i]
        if (nthChild) {
          const xs = transform(nthChild, i, node)
          if (xs) {
            for (let j = 0, m = xs.length; j < m; j++) {
              const item = xs[j]
              if (item) out.push(item)
            }
          }
        }
      }
      node.children = out
      if (enteredDroppedRawHtml && node.children.length === 0)
        return []
    }
    else if (enteredDroppedRawHtml) {
      return []
    }

    return fn(node, index, parent)
  }
}

// List of container node types that can contain block-level content
// and thus may need HTML content to be wrapped in paragraphs
const BLOCK_CONTAINER_TYPES = ['root', 'blockquote', 'listItem']

function sanitizeRawHtmlNode(node: Node, state: RawHtmlState) {
  const result = prepareGithubRawHtmlForSanitizerFragment(
    node.value as string,
    state.activeTag,
    state.activeMode,
    {
      activeDepth: state.activeDepth,
      gfmDisallowedRawHtmlTags,
      sanitizerOnlyDropWithContentTags,
    },
  )
  state.activeTag = result.activeTag
  state.activeMode = result.mode
  state.activeDepth = result.activeDepth || 1
  return result.value ? [{ ...node, value: result.value }] : []
}

/// @internal
/// This plugin should be deprecated after we support HTML.
export const remarkHtmlTransformer = $remark(
  'remarkHTMLTransformer',
  () => () => (tree: Node) => {
    flatMapWithDepth(tree, (node, _index, parent) => {
      if (!isHTML(node)) return [node]

      // If the parent is a block container that expects block content,
      // wrap the HTML in a paragraph node
      if (parent && BLOCK_CONTAINER_TYPES.includes(parent.type)) {
        node.children = [{ ...node }]
        delete node.value
        ;(node as { type: string }).type = 'paragraph'
      }

      return [node]
    })
  }
)

withMeta(remarkHtmlTransformer.plugin, {
  displayName: 'Remark<remarkHtmlTransformer>',
  group: 'Remark',
})

withMeta(remarkHtmlTransformer.options, {
  displayName: 'RemarkConfig<remarkHtmlTransformer>',
  group: 'Remark',
})
