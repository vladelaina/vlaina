import type { Node } from '@milkdown/prose/model'
import type { RootContent, Text } from 'hast'
import type { Refractor } from 'refractor/core'

import { findChildren } from '@milkdown/prose'
import { Decoration, DecorationSet } from '@milkdown/prose/view'

interface FlattedNode {
  text: string
  className: string[]
}

export const MAX_PRISM_CODE_CHARS = 200_000
export const MAX_PRISM_HAST_DEPTH = 200
export const MAX_PRISM_HAST_NODES = 50_000

export function canHighlightPrismCode(value: string) {
  return value.length <= MAX_PRISM_CODE_CHARS
}

export function readHighlightablePrismCode(node: Node) {
  if (node.content.size > MAX_PRISM_CODE_CHARS) {
    return null
  }

  const code = node.textBetween(0, node.content.size, '\n', '\n')
  return canHighlightPrismCode(code) ? code : null
}

export function flatNodes(nodes: RootContent[], className: string[] = []) {
  const output: FlattedNode[] = []
  const stack = [{ nodes, index: 0, className, depth: 0 }]
  let visitedNodes = 0

  while (stack.length > 0) {
    const frame = stack[stack.length - 1]
    if (frame.index >= frame.nodes.length) {
      stack.pop()
      continue
    }

    const node = frame.nodes[frame.index++]
    visitedNodes += 1
    if (visitedNodes > MAX_PRISM_HAST_NODES || frame.depth > MAX_PRISM_HAST_DEPTH) {
      return null
    }

    if (node.type === 'element') {
      stack.push({
        nodes: node.children,
        index: 0,
        className: [
          ...frame.className,
          ...((node.properties?.className as string[]) || []),
        ],
        depth: frame.depth + 1,
      })
      continue
    }

    if (node.type === 'text') {
      output.push({ text: (node as Text).value, className: frame.className })
    }
  }

  return output
}

export function getDecorations(doc: Node, name: string, refractor: Refractor) {
  const { highlight, listLanguages } = refractor
  const allLanguages = listLanguages()
  const decorations: Decoration[] = []

  findChildren((node) => node.type.name === name)(doc).forEach((block) => {
    let from = block.pos + 1
    const { language } = block.node.attrs
    if (!language || !allLanguages.includes(language)) {
      console.warn(
        'Unsupported language detected, this language has not been supported by current prism config: ',
        language
      )
      return
    }
    const code = readHighlightablePrismCode(block.node)
    if (code == null) {
      return
    }

    let nodes: ReturnType<typeof highlight>
    try {
      nodes = highlight(code, language)
    } catch {
      return
    }

    const flattenedNodes = flatNodes(nodes.children)
    if (!flattenedNodes) {
      return
    }

    flattenedNodes.forEach((node) => {
      const to = from + node.text.length

      if (node.className.length) {
        const decoration = Decoration.inline(from, to, {
          class: node.className.join(' '),
        })

        decorations.push(decoration)
      }

      from = to
    })
  })

  return DecorationSet.create(doc, decorations)
}
