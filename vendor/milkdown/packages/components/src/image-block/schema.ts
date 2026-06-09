import { expectDomTypeError } from '@milkdown/exception'
import { sanitizeImageSrc } from '@milkdown/preset-commonmark'
import { $nodeSchema } from '@milkdown/utils'

import { withMeta } from '../__internal__/meta'

export const IMAGE_DATA_TYPE = 'image-block'
export const MAX_IMAGE_BLOCK_CAPTION_CHARS = 4096
export const MAX_IMAGE_BLOCK_RATIO = 100

export function normalizeImageBlockCaption(value: unknown) {
  return typeof value === 'string'
    ? value.slice(0, MAX_IMAGE_BLOCK_CAPTION_CHARS)
    : ''
}

export function normalizeImageBlockRatio(value: unknown) {
  const ratio = typeof value === 'number' ? value : Number(value ?? 1)
  if (!Number.isFinite(ratio) || ratio <= 0) return 1
  return Math.min(ratio, MAX_IMAGE_BLOCK_RATIO)
}

export const imageBlockSchema = $nodeSchema('image-block', () => {
  return {
    inline: false,
    group: 'block',
    selectable: true,
    draggable: true,
    isolating: true,
    marks: '',
    atom: true,
    priority: 100,
    attrs: {
      src: { default: '', validate: 'string' },
      caption: { default: '', validate: 'string' },
      ratio: { default: 1, validate: 'number' },
    },
    parseDOM: [
      {
        tag: `img[data-type="${IMAGE_DATA_TYPE}"]`,
        getAttrs: (dom) => {
          if (!(dom instanceof HTMLElement)) throw expectDomTypeError(dom)
          const src = sanitizeImageSrc(dom.getAttribute('src'))
          if (!src) return false

          return {
            src,
            caption: normalizeImageBlockCaption(dom.getAttribute('caption')),
            ratio: normalizeImageBlockRatio(dom.getAttribute('ratio')),
          }
        },
      },
    ],
    toDOM: (node) => {
      const src = sanitizeImageSrc(node.attrs.src)
      return [
        'img',
        {
          'data-type': IMAGE_DATA_TYPE,
          ...node.attrs,
          src: src ?? undefined,
          caption: normalizeImageBlockCaption(node.attrs.caption),
          ratio: normalizeImageBlockRatio(node.attrs.ratio),
        },
      ]
    },
    parseMarkdown: {
      match: ({ type }) => type === 'image-block',
      runner: (state, node, type) => {
        const src = sanitizeImageSrc(node.url)
        if (!src) return
        const caption = normalizeImageBlockCaption(node.title)
        const ratio = normalizeImageBlockRatio(node.alt)

        state.addNode(type, {
          src,
          caption,
          ratio,
        })
      },
    },
    toMarkdown: {
      match: (node) => node.type.name === 'image-block',
      runner: (state, node) => {
        const src = sanitizeImageSrc(node.attrs.src)
        if (!src) return
        state.openNode('paragraph')
        state.addNode('image', undefined, undefined, {
          title: normalizeImageBlockCaption(node.attrs.caption),
          url: src,
          alt: `${normalizeImageBlockRatio(node.attrs.ratio).toFixed(2)}`,
        })
        state.closeNode()
      },
    },
  }
})

withMeta(imageBlockSchema.node, {
  displayName: 'NodeSchema<image-block>',
  group: 'ImageBlock',
})
