import type { Node, NodeType } from '@milkdown/prose/model'
import type { EditorView } from '@milkdown/prose/view'

import { Plugin, PluginKey } from '@milkdown/prose/state'
import { $prose } from '@milkdown/utils'

import { withMeta } from '../__internal__'
import { headingIdGenerator, headingSchema } from '../node/heading'

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
    const tr = view.state.tr.setMeta('addToHistory', false)

    let found = false
    const idMap: Record<string, number> = {}

    view.state.doc.descendants((node, pos) => {
      if (node.type === headingType) {
        if (node.textContent.trim().length === 0) return

        const attrs = node.attrs
        let id = getId(node)
        if (idMap[id]) {
          idMap[id]! += 1
          id += `-#${idMap[id]}`
        } else {
          idMap[id] = 1
        }

        if (attrs.id !== id) {
          found = true
          tr.setMeta(headingIdPluginKey, true).setNodeMarkup(pos, undefined, {
            ...attrs,
            id,
          })
        }
      }
    })

    if (found) view.dispatch(tr)
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
