import { Plugin, PluginKey } from '@milkdown/prose/state'
import { AddMarkStep, ReplaceStep } from '@milkdown/prose/transform'
import { $prose } from '@milkdown/utils'

import { withMeta } from '../__internal__'
import { hardbreakSchema } from '../node'

/// This plugin is used to clear the marks around the hardbreak node.
export const hardbreakClearMarkPlugin = $prose((ctx) => {
  const hardbreakType = hardbreakSchema.type(ctx)

  return new Plugin({
    key: new PluginKey('MILKDOWN_HARDBREAK_MARKS'),
    appendTransaction: (trs, _oldState, newState) => {
      if (!trs.length) return

      let nextTr = newState.tr
      let changed = false

      const clearHardbreakAt = (pos: number) => {
        const node = nextTr.doc.nodeAt(pos)
        if (node?.type !== hardbreakType || !node.marks.length) return

        nextTr = nextTr.setNodeMarkup(pos, hardbreakType, node.attrs, [])
        changed = true
      }

      const clearHardbreaksInRange = (from: number, to: number) => {
        const start = Math.max(0, Math.min(from, nextTr.doc.content.size))
        const end = Math.max(start, Math.min(to, nextTr.doc.content.size))

        nextTr.doc.nodesBetween(start, end, (node, pos) => {
          if (node.type === hardbreakType && node.marks.length) {
            nextTr = nextTr.setNodeMarkup(pos, hardbreakType, node.attrs, [])
            changed = true
          }
        })
      }

      for (const tr of trs) {
        const isInsertHr = tr.getMeta('hardbreak')

        for (const step of tr.steps) {
          if (isInsertHr && step instanceof ReplaceStep) {
            const { from } = step as unknown as { from: number }
            clearHardbreakAt(from)
          }

          if (step instanceof AddMarkStep) {
            const { from, to } = step as unknown as {
              from: number
              to: number
            }
            clearHardbreaksInRange(from, to)
          }
        }
      }

      return changed ? nextTr : undefined
    },
  })
})

withMeta(hardbreakClearMarkPlugin, {
  displayName: 'Prose<hardbreakClearMarkPlugin>',
  group: 'Prose',
})
