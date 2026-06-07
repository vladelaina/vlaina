import type { Node, NodeType } from '@milkdown/prose/model'
import type { EditorView } from '@milkdown/prose/view'

import { Plugin, PluginKey } from '@milkdown/prose/state'
import { $prose } from '@milkdown/utils'

import { withMeta } from '../__internal__'
import { headingIdGenerator, headingSchema } from '../node/heading'

export const MAX_HEADING_ID_SYNC_SCAN_NODES = 20_000
export const MAX_HEADING_ID_SYNC_UPDATES = 5_000

export interface HeadingIdUpdate {
  attrs: Record<string, unknown>
  pos: number
}

export function collectHeadingIdUpdates(
  doc: Node,
  headingType: NodeType,
  getId: (node: Node) => string,
  maxScanNodes = MAX_HEADING_ID_SYNC_SCAN_NODES,
  maxUpdates = MAX_HEADING_ID_SYNC_UPDATES
): HeadingIdUpdate[] {
  const updates: HeadingIdUpdate[] = []
  const idMap: Record<string, number> = {}
  let scanned = 0
  const stack: Array<{
    contentStart: number
    index: number
    node: Node
    offset: number
  }> = [{
    contentStart: 0,
    index: 0,
    node: doc,
    offset: 0,
  }]

  while (stack.length > 0) {
    const frame = stack[stack.length - 1]!
    if (frame.index >= frame.node.childCount) {
      stack.pop()
      continue
    }

    if (
      scanned >= maxScanNodes ||
      updates.length >= maxUpdates
    ) {
      break
    }

    const node = frame.node.child(frame.index)
    const pos = frame.contentStart + frame.offset
    frame.index += 1
    frame.offset += node.nodeSize
    scanned += 1

    if (node.type === headingType) {
      if (node.textContent.trim().length === 0) continue

      const attrs = node.attrs
      let id = getId(node)
      if (idMap[id]) {
        idMap[id]! += 1
        id += `-#${idMap[id]}`
      } else {
        idMap[id] = 1
      }

      if (attrs.id !== id) {
        updates.push({
          attrs: {
            ...attrs,
            id,
          },
          pos,
        })
      }

      continue
    }

    if (node.childCount > 0) {
      stack.push({
        contentStart: pos + 1,
        index: 0,
        node,
        offset: 0,
      })
    }
  }

  return updates
}

/// This plugin is used to sync the heading id when the heading content changes.
/// It will use the `headingIdGenerator` to generate the id.
export const syncHeadingIdPlugin = $prose((ctx) => {
  const headingIdPluginKey = new PluginKey('MILKDOWN_HEADING_ID')
  const headingType = headingSchema.type(ctx)

  const rangeHasHeading = (
    doc: Node,
    from: number,
    to: number,
    type: NodeType
  ) => {
    const start = Math.max(0, Math.min(from - 1, doc.content.size))
    const end = Math.max(start, Math.min(to + 1, doc.content.size))
    let hasHeading = false
    doc.nodesBetween(start, end, (node) => {
      if (node.type === type) {
        hasHeading = true
        return false
      }
      return !hasHeading
    })
    return hasHeading
  }

  const docChangeMayAffectHeadingIds = (prevDoc: Node, nextDoc: Node) => {
    const diffStart = prevDoc.content.findDiffStart(nextDoc.content)
    if (diffStart === null) return false

    const diffEnd = prevDoc.content.findDiffEnd(nextDoc.content)
    if (!diffEnd) return true

    return (
      rangeHasHeading(prevDoc, diffStart, diffEnd.a, headingType) ||
      rangeHasHeading(nextDoc, diffStart, diffEnd.b, headingType)
    )
  }

  const updateId = (view: EditorView) => {
    if (view.composing) return

    const getId = ctx.get(headingIdGenerator.key)
    const updates = collectHeadingIdUpdates(view.state.doc, headingType, getId)
    if (updates.length === 0) return

    const tr = view.state.tr.setMeta('addToHistory', false)
    updates.forEach((update) => {
      tr.setMeta(headingIdPluginKey, true).setNodeMarkup(update.pos, undefined, update.attrs)
    })

    view.dispatch(tr)
  }

  return new Plugin({
    key: headingIdPluginKey,
    view: (view) => {
      updateId(view)

      return {
        update: (view, prevState) => {
          if (view.state.doc.eq(prevState.doc)) return
          if (!docChangeMayAffectHeadingIds(prevState.doc, view.state.doc))
            return
          updateId(view)
        },
      }
    },
  })
})

withMeta(syncHeadingIdPlugin, {
  displayName: 'Prose<syncHeadingIdPlugin>',
  group: 'Prose',
})
