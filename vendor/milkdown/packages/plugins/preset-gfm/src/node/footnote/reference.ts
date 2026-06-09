import { expectDomTypeError } from '@milkdown/exception'
import { $nodeSchema } from '@milkdown/utils'

import { withMeta } from '../../__internal__'

const id = 'footnote_reference'
const MAX_FOOTNOTE_LABEL_ATTR_CHARS = 512

function normalizeFootnoteLabelAttr(value: unknown) {
  return typeof value === 'string' && value.length <= MAX_FOOTNOTE_LABEL_ATTR_CHARS
    ? value
    : ''
}

/// Footnote reference node schema.
export const footnoteReferenceSchema = $nodeSchema(
  'footnote_reference',
  () => ({
    group: 'inline',
    inline: true,
    atom: true,
    attrs: {
      label: {
        default: '',
        validate: 'string',
      },
    },
    parseDOM: [
      {
        tag: `sup[data-type="${id}"]`,
        getAttrs: (dom) => {
          if (!(dom instanceof HTMLElement)) throw expectDomTypeError(dom)

          return {
            label: normalizeFootnoteLabelAttr(dom.dataset.label),
          }
        },
      },
    ],
    toDOM: (node) => {
      const label = node.attrs.label
      return [
        'sup',
        {
          // TODO: add a prosemirror plugin to sync label on change
          'data-label': label,
          'data-type': id,
        },
        label,
      ]
    },
    parseMarkdown: {
      match: ({ type }) => type === 'footnoteReference',
      runner: (state, node, type) => {
        state.addNode(type, {
          label: node.label as string,
        })
      },
    },
    toMarkdown: {
      match: (node) => node.type.name === id,
      runner: (state, node) => {
        state.addNode('footnoteReference', undefined, undefined, {
          label: node.attrs.label,
          identifier: node.attrs.label,
        })
      },
    },
  })
)

withMeta(footnoteReferenceSchema.ctx, {
  displayName: 'NodeSchemaCtx<footnodeRef>',
  group: 'footnote',
})

withMeta(footnoteReferenceSchema.node, {
  displayName: 'NodeSchema<footnodeRef>',
  group: 'footnote',
})
