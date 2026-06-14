import type { Node as ProsemirrorNode } from '@milkdown/prose/model'

import {
  editorViewOptionsCtx,
  parserCtx,
  schemaCtx,
  serializerCtx,
} from '@milkdown/core'
import { getNodeFromSchema, isTextOnlySlice } from '@milkdown/prose'
import { DOMParser, DOMSerializer } from '@milkdown/prose/model'
import { Plugin, PluginKey, TextSelection } from '@milkdown/prose/state'
import { $prose } from '@milkdown/utils'

import { isPureText } from './__internal__/is-pure-text'
import { withMeta } from './__internal__/with-meta'

const maxVscodeEditorDataChars = 16 * 1024
export const maxClipboardTextChars = 1024 * 1024
export const maxClipboardHtmlChars = 1024 * 1024
export const maxClipboardHtmlNodes = 20_000
export const maxClipboardHtmlDepth = 128

export function parseVscodeEditorDataMode(value: string) {
  if (!value || value.length > maxVscodeEditorDataChars) return null

  try {
    const data = JSON.parse(value) as { mode?: unknown }
    return typeof data?.mode === 'string' && data.mode.length <= 128
      ? data.mode
      : null
  } catch {
    return null
  }
}

export function canParseClipboardPayload(text: string, html: string) {
  return text.length <= maxClipboardTextChars && html.length <= maxClipboardHtmlChars
}

export function isClipboardHtmlWithinDomBudget(html: string) {
  if (html.length > maxClipboardHtmlChars) return false

  const template = document.createElement('template')
  template.innerHTML = html

  const stack: Array<{ node: Node; depth: number }> = []
  for (let node = template.content.lastChild; node; node = node.previousSibling)
    stack.push({ node, depth: 1 })

  let visitedNodes = 0
  while (stack.length > 0) {
    const { node, depth } = stack.pop()!
    visitedNodes += 1
    if (visitedNodes > maxClipboardHtmlNodes || depth > maxClipboardHtmlDepth) {
      template.remove()
      return false
    }

    for (let child = node.lastChild; child; child = child.previousSibling)
      stack.push({ node: child, depth: depth + 1 })
  }

  template.remove()
  return true
}

/// The prosemirror plugin for clipboard.
export const clipboard = $prose((ctx) => {
  const schema = ctx.get(schemaCtx)
  let acceptedClipboardHtml: string | null = null
  let blockedClipboardHtml: string | null = null

  ctx.update(editorViewOptionsCtx, (prev) => ({
    ...prev,
    editable: prev.editable ?? (() => true),
  }))

  const key = new PluginKey('MILKDOWN_CLIPBOARD')
  const plugin = new Plugin({
    key,
    props: {
      handleDOMEvents: {
        paste: (view, event) => {
          acceptedClipboardHtml = null
          blockedClipboardHtml = null

          const editable = view.props.editable?.(view.state)
          const { clipboardData } = event
          if (!editable || !clipboardData) return false

          const text = clipboardData.getData('text/plain')
          const html = clipboardData.getData('text/html')
          if (!canParseClipboardPayload(text, html) || (html && !isClipboardHtmlWithinDomBudget(html))) {
            blockedClipboardHtml = html || null
            event.preventDefault()
            return true
          }

          acceptedClipboardHtml = html || null
          return false
        },
      },
      transformPastedHTML: (html) => {
        blockedClipboardHtml = null
        if (html === acceptedClipboardHtml) {
          acceptedClipboardHtml = null
          return html
        }

        acceptedClipboardHtml = null
        if (!isClipboardHtmlWithinDomBudget(html)) {
          blockedClipboardHtml = html
          return ''
        }

        return html
      },
      handlePaste: (view, event, pastedSlice) => {
        const parser = ctx.get(parserCtx)
        const editable = view.props.editable?.(view.state)
        const { clipboardData } = event
        if (!editable || !clipboardData) return false

        const text = clipboardData.getData('text/plain')
        const html = clipboardData.getData('text/html')
        if (blockedClipboardHtml && html === blockedClipboardHtml) {
          blockedClipboardHtml = null
          return true
        }
        blockedClipboardHtml = null
        if (!canParseClipboardPayload(text, html)) return true

        const currentNode = view.state.selection.$from.node()
        if (currentNode.type.spec.code) return false

        // if is copied from vscode, try to create a code block
        const vscodeData = clipboardData.getData('vscode-editor-data')
        if (vscodeData) {
          const language = parseVscodeEditorDataMode(vscodeData)
          if (text && language) {
            const { tr } = view.state
            const codeBlock = getNodeFromSchema('code_block', schema)

            tr.replaceSelectionWith(codeBlock.create({ language }))
              .setSelection(
                TextSelection.near(
                  tr.doc.resolve(Math.max(0, tr.selection.from - 2))
                )
              )
              .insertText(text.replace(/\r\n?/g, '\n'))

            view.dispatch(tr)
            return true
          }
        }

        if (html.length === 0 && text.length === 0) return false

        let slice = pastedSlice
        if (html.length === 0) {
          const parsedSlice = parser(text)
          if (!parsedSlice || typeof parsedSlice === 'string') return false

          const dom = DOMSerializer.fromSchema(schema).serializeFragment(
            parsedSlice.content
          )
          slice = DOMParser.fromSchema(schema).parseSlice(dom)
        }

        const node = isTextOnlySlice(slice)
        if (node) {
          view.dispatch(view.state.tr.replaceSelectionWith(node, true))
          return true
        }

        try {
          view.dispatch(view.state.tr.replaceSelection(slice))
          return true
        } catch {
          return false
        }
      },
      clipboardTextSerializer: (slice) => {
        const serializer = ctx.get(serializerCtx)
        const isText = isPureText(slice.content.toJSON())
        if (isText)
          return (slice.content as unknown as ProsemirrorNode).textBetween(
            0,
            slice.content.size,
            '\n\n'
          )

        const doc = schema.topNodeType.createAndFill(undefined, slice.content)
        if (!doc) return ''
        const value = serializer(doc)
        return value
      },
    },
  })

  return plugin
})

withMeta(clipboard, { displayName: 'Prose<clipboard>' })
