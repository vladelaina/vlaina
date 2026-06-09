import { expectDomTypeError } from '@milkdown/exception'
import { $nodeSchema } from '@milkdown/utils'

import { withMeta } from '../../__internal__'

const id = 'footnote_definition'
const markdownId = 'footnoteDefinition'
const MAX_FOOTNOTE_LABEL_ATTR_CHARS = 512

function normalizeFootnoteLabelAttr(value: unknown) {
  return typeof value === 'string' && value.length <= MAX_FOOTNOTE_LABEL_ATTR_CHARS
    ? value
    : ''
}

/// Footnote definition node schema.
export const footnoteDefinitionSchema = $nodeSchema(
  'footnote_definition',
  () => ({
    group: 'block',
    content: 'block+',
    defining: true,
    attrs: {
      label: {
        default: '',
        validate: 'string',
      },
    },
    parseDOM: [
      {
        tag: `dl[data-type="${id}"]`,
        getAttrs: (dom) => {
          if (!(dom instanceof HTMLElement)) throw expectDomTypeError(dom)

          return {
            label: normalizeFootnoteLabelAttr(dom.dataset.label),
          }
        },
        contentElement: 'dd',
      },
    ],
    toDOM: (node) => {
      const label = node.attrs.label

      return [
        'dl',
        {
          // TODO: add a prosemirror plugin to sync label on change
          'data-label': label,
          'data-type': id,
        },
        ['dt', label],
        ['dd', 0],
      ]
    },
    parseMarkdown: {
      match: ({ type }) => type === markdownId,
      runner: (state, node, type) => {
        state
          .openNode(type, {
            label: node.label as string,
          })
          .next(node.children)
          .closeNode()
      },
    },
    toMarkdown: {
      match: (node) => node.type.name === id,
      runner: (state, node) => {
        state
          .openNode(markdownId, undefined, {
            label: node.attrs.label,
            identifier: node.attrs.label,
          })
          .next(node.content)
          .closeNode()
      },
    },
  })
)

withMeta(footnoteDefinitionSchema.ctx, {
  displayName: 'NodeSchemaCtx<footnodeDef>',
  group: 'footnote',
})

withMeta(footnoteDefinitionSchema.node, {
  displayName: 'NodeSchema<footnodeDef>',
  group: 'footnote',
})
