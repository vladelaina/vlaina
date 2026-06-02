import { expectDomTypeError } from '@milkdown/exception'
import { sanitizeImageSrc } from '@milkdown/preset-commonmark'
import { $nodeSchema } from '@milkdown/utils'

import { withMeta } from '../__internal__/meta'

export const IMAGE_DATA_TYPE = 'image-block'

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
            caption: dom.getAttribute('caption') || '',
            ratio: Number(dom.getAttribute('ratio') ?? 1),
          }
        },
      },
    ],
    toDOM: (node) => {
      const src = sanitizeImageSrc(node.attrs.src)
      return [
        'img',
        { 'data-type': IMAGE_DATA_TYPE, ...node.attrs, src: src ?? undefined },
      ]
    },
    parseMarkdown: {
      match: ({ type }) => type === 'image-block',
      runner: (state, node, type) => {
        const src = sanitizeImageSrc(node.url)
        if (!src) return
        const caption = node.title as string
        let ratio = Number((node.alt as string) || 1)
        if (Number.isNaN(ratio) || ratio === 0) ratio = 1

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
          title: node.attrs.caption,
          url: src,
          alt: `${Number.parseFloat(node.attrs.ratio).toFixed(2)}`,
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
