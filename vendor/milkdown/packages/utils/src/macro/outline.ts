import type { Ctx } from '@milkdown/ctx'

import { editorViewCtx } from '@milkdown/core'

const MAX_OUTLINE_HEADING_TEXT_CHARS = 4096

function getBoundedHeadingText(node: {
  descendants?: (callback: (child: { isText?: boolean; text?: string | null }) => boolean | void) => void
  textContent?: string
}): string {
  let text = ''

  if (typeof node.descendants === 'function') {
    node.descendants((child) => {
      if (!child.isText || !child.text)
        return true

      const remaining = MAX_OUTLINE_HEADING_TEXT_CHARS - text.length
      if (remaining <= 0)
        return false

      text += child.text.length > remaining ? child.text.slice(0, remaining) : child.text
      return text.length < MAX_OUTLINE_HEADING_TEXT_CHARS
    })
    return text
  }

  return (node.textContent ?? '').slice(0, MAX_OUTLINE_HEADING_TEXT_CHARS)
}

/// Get outline of the editor.
export function outline() {
  return (ctx: Ctx): Array<{ text: string; level: number; id: string }> => {
    const view = ctx.get(editorViewCtx)
    const data: { text: string; level: number; id: string }[] = []
    const doc = view.state.doc
    doc.descendants((node) => {
      if (node.type.name === 'heading' && node.attrs.level)
        data.push({
          text: getBoundedHeadingText(node),
          level: node.attrs.level,
          id: node.attrs.id,
        })
    })
    return data
  }
}
