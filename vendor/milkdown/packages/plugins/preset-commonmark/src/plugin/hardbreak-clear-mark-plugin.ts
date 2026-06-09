import type { Node } from '@milkdown/prose/model'
import type { Transaction } from '@milkdown/prose/state'

import { Plugin, PluginKey } from '@milkdown/prose/state'
import { AddMarkStep, ReplaceStep } from '@milkdown/prose/transform'
import { $prose } from '@milkdown/utils'

import { withMeta } from '../__internal__'
import { hardbreakSchema } from '../node'

export const MAX_HARDBREAK_CLEAR_MARK_SCAN_NODES = 20_000

export function clearMarkedHardbreaksInRange(
  tr: Transaction,
  hardbreakType: unknown,
  from: number,
  to: number,
  maxScanNodes = MAX_HARDBREAK_CLEAR_MARK_SCAN_NODES
) {
  let nextTr = tr
  let changed = false
  const start = Math.max(0, Math.min(from, nextTr.doc.content.size))
  const end = Math.max(start, Math.min(to, nextTr.doc.content.size))
  let scanned = 0

  const stack: Array<{
    contentStart: number
    index: number
    node: Node
    offset: number
  }> = [{
    contentStart: 0,
    index: 0,
    node: nextTr.doc,
    offset: 0,
  }]

  while (stack.length > 0 && scanned < maxScanNodes) {
    const frame = stack[stack.length - 1]!
    if (frame.index >= frame.node.childCount) {
      stack.pop()
      continue
    }

    const node = frame.node.child(frame.index)
    const pos = frame.contentStart + frame.offset
    const nodeEnd = pos + node.nodeSize
    frame.index += 1
    frame.offset += node.nodeSize

    if (nodeEnd < start) continue
    if (pos > end) break

    scanned += 1
    if (node.type === hardbreakType && node.marks.length) {
      nextTr = nextTr.setNodeMarkup(pos, hardbreakType as never, node.attrs, [])
      changed = true
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

  return { tr: nextTr, changed }
}

function mapStepPosToFinalDoc(
  transactions: readonly Transaction[],
  transactionIndex: number,
  stepIndex: number,
  pos: number,
  assoc: -1 | 1
) {
  let mapped = transactions[transactionIndex].mapping.slice(stepIndex + 1).map(pos, assoc)
  for (let index = transactionIndex + 1; index < transactions.length; index++) {
    mapped = transactions[index].mapping.map(mapped, assoc)
  }
  return mapped
}

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
        const result = clearMarkedHardbreaksInRange(nextTr, hardbreakType, from, to)
        nextTr = result.tr
        changed ||= result.changed
      }

      for (const [transactionIndex, tr] of trs.entries()) {
        const isInsertHr = tr.getMeta('hardbreak')

        for (const [stepIndex, step] of tr.steps.entries()) {
          if (isInsertHr && step instanceof ReplaceStep) {
            const { from } = step as unknown as { from: number }
            clearHardbreakAt(mapStepPosToFinalDoc(trs, transactionIndex, stepIndex, from, 1))
          }

          if (step instanceof AddMarkStep) {
            const { from, to } = step as unknown as {
              from: number
              to: number
            }
            const mappedFrom = mapStepPosToFinalDoc(trs, transactionIndex, stepIndex, from, 1)
            const mappedTo = mapStepPosToFinalDoc(trs, transactionIndex, stepIndex, to, -1)
            clearHardbreaksInRange(
              Math.min(mappedFrom, mappedTo),
              Math.max(mappedFrom, mappedTo)
            )
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
