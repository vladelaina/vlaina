import { expectDomTypeError } from '@milkdown/exception'
import { findSelectedNodeOfType } from '@milkdown/prose'
import { InputRule } from '@milkdown/prose/inputrules'
import { $command, $inputRule, $nodeAttr, $nodeSchema } from '@milkdown/utils'

import { withMeta } from '../__internal__'

const controlOrBidiPattern = /[\u0000-\u001F\u007F\u202A-\u202E\u2066-\u2069\uFFFD]/
const schemePattern = /^([A-Za-z][A-Za-z0-9+.-]*):/
const windowsAbsolutePathPattern = /^[A-Za-z]:[\\/]/
const unixAbsolutePathPattern = /^\//
const safeMediaSchemes = new Set(['http:', 'https:', 'blob:'])

function parseIPv4(hostname: string) {
  const parts = hostname.split('.')
  if (parts.length !== 4) return null
  const octets = parts.map((part) => Number(part))
  if (octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) return null
  return octets
}

function isPrivateHttpUrl(value: string) {
  try {
    const url = new URL(value, window.location.href)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false
    const hostname = url.hostname.replace(/^\[|\]$/g, '').toLowerCase()
    const ipv4 = parseIPv4(hostname)
    const mappedIPv6 = hostname.startsWith('::ffff:')
      ? hostname.slice('::ffff:'.length).split(':')
      : null
    const mappedIPv4 = mappedIPv6?.length === 2
      ? [
          (Number.parseInt(mappedIPv6[0], 16) >> 8) & 255,
          Number.parseInt(mappedIPv6[0], 16) & 255,
          (Number.parseInt(mappedIPv6[1], 16) >> 8) & 255,
          Number.parseInt(mappedIPv6[1], 16) & 255,
        ]
      : null
    return (
      hostname === 'localhost'
      || hostname === '::1'
      || hostname.startsWith('fe80:')
      || hostname.startsWith('fc')
      || hostname.startsWith('fd')
      || Boolean(mappedIPv4 && (
        mappedIPv4[0] === 0
        || mappedIPv4[0] === 10
        || mappedIPv4[0] === 127
        || (mappedIPv4[0] === 169 && mappedIPv4[1] === 254)
        || (mappedIPv4[0] === 172 && mappedIPv4[1] >= 16 && mappedIPv4[1] <= 31)
        || (mappedIPv4[0] === 192 && mappedIPv4[1] === 168)
      ))
      || Boolean(ipv4 && (
        ipv4[0] === 0
        || ipv4[0] === 10
        || ipv4[0] === 127
        || (ipv4[0] === 169 && ipv4[1] === 254)
        || (ipv4[0] === 172 && ipv4[1] >= 16 && ipv4[1] <= 31)
        || (ipv4[0] === 192 && ipv4[1] === 168)
      ))
    )
  } catch {
    return false
  }
}

function isPublicRemoteMediaUrl(value: string) {
  if (!value.startsWith('//') && !/^https?:/i.test(value)) return false
  const normalized = value.startsWith('//') ? `https:${value}` : value
  try {
    const url = new URL(normalized, window.location.href)
    return (
      (url.protocol === 'http:' || url.protocol === 'https:')
      && !isPrivateHttpUrl(normalized)
    )
  } catch {
    return false
  }
}

function sanitizeMediaSrc(value: unknown) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed || controlOrBidiPattern.test(trimmed) || windowsAbsolutePathPattern.test(trimmed) || (unixAbsolutePathPattern.test(trimmed) && !trimmed.startsWith('//'))) return null
  if (trimmed.startsWith('//')) return isPrivateHttpUrl(`https:${trimmed}`) ? null : trimmed

  const scheme = schemePattern.exec(trimmed)?.[1]?.toLowerCase()
  if (!scheme) return trimmed
  const normalizedScheme = `${scheme}:`
  if (!safeMediaSchemes.has(normalizedScheme)) return null
  if ((normalizedScheme === 'http:' || normalizedScheme === 'https:') && isPrivateHttpUrl(trimmed)) return null
  return trimmed
}

/// HTML attributes for image node.
export const imageAttr = $nodeAttr('image')

withMeta(imageAttr, {
  displayName: 'Attr<image>',
  group: 'Image',
})

/// Schema for image node.
export const imageSchema = $nodeSchema('image', (ctx) => {
  return {
    inline: true,
    group: 'inline',
    selectable: true,
    draggable: true,
    marks: '',
    atom: true,
    defining: true,
    isolating: true,
    attrs: {
      src: { default: '', validate: 'string' },
      alt: { default: '', validate: 'string' },
      title: { default: '', validate: 'string' },
    },
    parseDOM: [
      {
        tag: 'img[src]',
        getAttrs: (dom) => {
          if (!(dom instanceof HTMLElement)) throw expectDomTypeError(dom)
          const src = sanitizeMediaSrc(dom.getAttribute('src'))
          if (!src) return false

          return {
            src,
            alt: dom.getAttribute('alt') || '',
            title: dom.getAttribute('title') || dom.getAttribute('alt') || '',
          }
        },
      },
    ],
    toDOM: (node) => {
      const src = sanitizeMediaSrc(node.attrs.src)
      return [
        'img',
        { ...ctx.get(imageAttr.key)(node), ...node.attrs, src: src && !isPublicRemoteMediaUrl(src) ? src : undefined },
      ]
    },
    parseMarkdown: {
      match: ({ type }) => type === 'image',
      runner: (state, node, type) => {
        const url = sanitizeMediaSrc(node.url)
        if (!url) return
        const alt = node.alt as string
        const title = node.title as string
        state.addNode(type, {
          src: url,
          alt,
          title,
        })
      },
    },
    toMarkdown: {
      match: (node) => node.type.name === 'image',
      runner: (state, node) => {
        const src = sanitizeMediaSrc(node.attrs.src)
        if (!src) return
        state.addNode('image', undefined, undefined, {
          title: node.attrs.title,
          url: src,
          alt: node.attrs.alt,
        })
      },
    },
  }
})

withMeta(imageSchema.node, {
  displayName: 'NodeSchema<image>',
  group: 'Image',
})

withMeta(imageSchema.ctx, {
  displayName: 'NodeSchemaCtx<image>',
  group: 'Image',
})

/// @internal
export interface UpdateImageCommandPayload {
  src?: string
  title?: string
  alt?: string
}

/// This command will insert a image node.
/// You can pass a payload to set `src`, `alt` and `title` for the image node.
export const insertImageCommand = $command(
  'InsertImage',
  (ctx) =>
    (payload: UpdateImageCommandPayload = {}) =>
    (state, dispatch) => {
      if (!dispatch) return true

      const { src = '', alt = '', title = '' } = payload

      const node = imageSchema.type(ctx).create({ src, alt, title })
      if (!node) return true

      dispatch(state.tr.replaceSelectionWith(node).scrollIntoView())
      return true
    }
)

withMeta(insertImageCommand, {
  displayName: 'Command<insertImageCommand>',
  group: 'Image',
})

/// This command will update the selected image node.
/// You can pass a payload to update `src`, `alt` and `title` for the image node.
export const updateImageCommand = $command(
  'UpdateImage',
  (ctx) =>
    (payload: UpdateImageCommandPayload = {}) =>
    (state, dispatch) => {
      const nodeWithPos = findSelectedNodeOfType(
        state.selection,
        imageSchema.type(ctx)
      )
      if (!nodeWithPos) return false

      const { node, pos } = nodeWithPos

      const newAttrs = { ...node.attrs }
      const { src, alt, title } = payload
      if (src !== undefined) newAttrs.src = src
      if (alt !== undefined) newAttrs.alt = alt
      if (title !== undefined) newAttrs.title = title

      dispatch?.(
        state.tr.setNodeMarkup(pos, undefined, newAttrs).scrollIntoView()
      )
      return true
    }
)

withMeta(updateImageCommand, {
  displayName: 'Command<updateImageCommand>',
  group: 'Image',
})

/// This input rule will insert a image node.
/// You can input `![alt](src "title")` to insert a image node.
/// The `title` is optional.
export const insertImageInputRule = $inputRule(
  (ctx) =>
    new InputRule(
      /(?:!|！)(?:\[|【)(?<alt>.*?)(?:\]|】)(?:\(|（)(?<filename>[^\s)）]+)(?:\s+(?:"|“)(?<title>[^"”]+)(?:"|”))?(?:\)|）)/,
      (state, match, start, end) => {
        const matched = match[0]
        const alt = match.groups?.alt ?? ''
        const src = match.groups?.filename ?? ''
        const title = match.groups?.title ?? ''
        if (matched)
          return state.tr.replaceWith(
            start,
            end,
            imageSchema.type(ctx).create({ src, alt, title })
          )

        return null
      }
    )
)

withMeta(insertImageInputRule, {
  displayName: 'InputRule<insertImageInputRule>',
  group: 'Image',
})
