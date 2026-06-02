import { expectDomTypeError } from '@milkdown/exception'
import { findSelectedNodeOfType } from '@milkdown/prose'
import { InputRule } from '@milkdown/prose/inputrules'
import { $command, $inputRule, $nodeAttr, $nodeSchema } from '@milkdown/utils'

import { isPublicRemoteMediaUrl, sanitizeMediaSrc, withMeta } from '../__internal__'

export function sanitizeImageSrc(
  value: unknown,
  options: { allowEmpty?: boolean } = {}
) {
  if (options.allowEmpty && value === '') return ''
  return sanitizeMediaSrc(value)
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
          const src = sanitizeImageSrc(dom.getAttribute('src'))
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
      const src = sanitizeImageSrc(node.attrs.src)
      return [
        'img',
        { ...ctx.get(imageAttr.key)(node), ...node.attrs, src: src && !isPublicRemoteMediaUrl(src) ? src : undefined },
      ]
    },
    parseMarkdown: {
      match: ({ type }) => type === 'image',
      runner: (state, node, type) => {
        const url = sanitizeImageSrc(node.url)
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
        const src = sanitizeImageSrc(node.attrs.src)
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
      const { src: inputSrc, alt = '', title = '' } = payload
      const src =
        inputSrc === undefined
          ? ''
          : sanitizeImageSrc(inputSrc, { allowEmpty: true })
      if (src == null) return false
      if (!dispatch) return true

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
      if (src !== undefined) {
        const safeSrc = sanitizeImageSrc(src, { allowEmpty: true })
        if (safeSrc == null) return false
        newAttrs.src = safeSrc
      }
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
  (ctx) => {
    const rule = new InputRule(
      /(?:!|！)(?:\[|【)(?<alt>.*?)(?:\]|】)(?:\(|（)(?<filename>[^\s)）]+)(?:\s+(?:"|“)(?<title>[^"”]+)(?:"|”))?(?:\)|）)/,
      (state, match, start, end) => {
        const matched = match[0]
        const alt = match.groups?.alt ?? ''
        const src = sanitizeImageSrc(match.groups?.filename ?? '')
        const title = match.groups?.title ?? ''
        if (matched && src)
          return state.tr.replaceWith(
            start,
            end,
            imageSchema.type(ctx).create({ src, alt, title })
          )

        return null
      }
    )
    rule.undoable = false
    return rule
  }
)

withMeta(insertImageInputRule, {
  displayName: 'InputRule<insertImageInputRule>',
  group: 'Image',
})
