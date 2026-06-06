import type { Node as ProseNode } from '@milkdown/prose/model'

import { expectDomTypeError } from '@milkdown/exception'
import { toggleMark } from '@milkdown/prose/commands'
import { TextSelection } from '@milkdown/prose/state'
import { $command, $markAttr, $markSchema } from '@milkdown/utils'

import { withMeta } from '../__internal__'

const controlOrBidiPattern = /[\u0000-\u001F\u007F\u202A-\u202E\u2066-\u2069\uFFFD]/
const schemePattern = /^([A-Za-z][A-Za-z0-9+.-]*):/
const windowsAbsolutePathPattern = /^[A-Za-z]:[\\/]/
const safeLinkSchemes = new Set(['http:', 'https:', 'mailto:'])
const maxLinkHrefChars = 16 * 1024

function hasUnsafeBackslashUrlSyntax(value: string) {
  return value.startsWith('\\') || (schemePattern.test(value) && value.includes('\\'))
}

export function sanitizeLinkHref(value: unknown) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed || trimmed.length > maxLinkHrefChars || trimmed.startsWith('//') || controlOrBidiPattern.test(trimmed) || hasUnsafeBackslashUrlSyntax(trimmed) || windowsAbsolutePathPattern.test(trimmed)) return null

  const scheme = schemePattern.exec(trimmed)?.[1]?.toLowerCase()
  if (!scheme) return trimmed
  const normalizedScheme = `${scheme}:`
  return safeLinkSchemes.has(normalizedScheme) ? trimmed : null
}

/// HTML attributes for the link mark.
export const linkAttr = $markAttr('link')

withMeta(linkAttr, {
  displayName: 'Attr<link>',
  group: 'Link',
})

/// Link mark schema.
export const linkSchema = $markSchema('link', (ctx) => ({
  attrs: {
    href: { validate: 'string' },
    title: { default: null, validate: 'string|null' },
  },
  parseDOM: [
    {
      tag: 'a[href]',
      getAttrs: (dom) => {
        if (!(dom instanceof HTMLElement)) throw expectDomTypeError(dom)
        const href = sanitizeLinkHref(dom.getAttribute('href'))
        if (!href) return false

        return {
          href,
          title: dom.getAttribute('title'),
        }
      },
    },
  ],
  toDOM: (mark) => {
    const href = sanitizeLinkHref(mark.attrs.href)
    return ['a', { ...ctx.get(linkAttr.key)(mark), ...mark.attrs, href: href ?? undefined }]
  },
  parseMarkdown: {
    match: (node) => node.type === 'link',
    runner: (state, node, markType) => {
      const url = sanitizeLinkHref(node.url)
      if (!url) {
        state.next(node.children)
        return
      }
      const title = node.title as string
      state.openMark(markType, { href: url, title })
      state.next(node.children)
      state.closeMark(markType)
    },
  },
  toMarkdown: {
    match: (mark) => mark.type.name === 'link',
    runner: (state, mark) => {
      const href = sanitizeLinkHref(mark.attrs.href)
      if (!href) return
      state.withMark(mark, 'link', undefined, {
        title: mark.attrs.title,
        url: href,
      })
    },
  },
}))

withMeta(linkSchema.mark, {
  displayName: 'MarkSchema<link>',
  group: 'Link',
})

/// @internal
export interface UpdateLinkCommandPayload {
  href?: string
  title?: string
}

function sanitizeLinkPayload(payload: UpdateLinkCommandPayload) {
  if (payload.href === undefined) return payload
  const href = sanitizeLinkHref(payload.href)
  if (!href) return null
  return { ...payload, href }
}

/// A command to toggle the link mark.
/// You can pass the `href` and `title` to the link.
export const toggleLinkCommand = $command(
  'ToggleLink',
  (ctx) =>
    (payload: UpdateLinkCommandPayload = {}) => {
      const attrs = sanitizeLinkPayload(payload)
      if (!attrs) return () => false
      return toggleMark(linkSchema.type(ctx), attrs)
    }
)

withMeta(toggleLinkCommand, {
  displayName: 'Command<toggleLinkCommand>',
  group: 'Link',
})

/// A command to update the link mark.
/// You can pass the `href` and `title` to update the link.
export const updateLinkCommand = $command(
  'UpdateLink',
  (ctx) =>
    (payload: UpdateLinkCommandPayload = {}) =>
    (state, dispatch) => {
      if (!dispatch) return false

      let node: ProseNode | undefined
      let pos = -1
      const { selection } = state
      const { from, to } = selection
      state.doc.nodesBetween(from, from === to ? to + 1 : to, (n, p) => {
        if (linkSchema.type(ctx).isInSet(n.marks)) {
          node = n
          pos = p
          return false
        }

        return undefined
      })

      if (!node) return false

      const mark = node.marks.find(({ type }) => type === linkSchema.type(ctx))
      if (!mark) return false

      const start = pos
      const end = pos + node.nodeSize
      const { tr } = state
      const attrs = sanitizeLinkPayload({ ...mark.attrs, ...payload })
      if (!attrs) return false
      const linkMark = linkSchema
        .type(ctx)
        .create(attrs)
      if (!linkMark) return false

      dispatch(
        tr
          .removeMark(start, end, mark)
          .addMark(start, end, linkMark)
          .setSelection(new TextSelection(tr.selection.$anchor))
          .scrollIntoView()
      )

      return true
    }
)

withMeta(updateLinkCommand, {
  displayName: 'Command<updateLinkCommand>',
  group: 'Link',
})
