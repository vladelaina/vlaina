import { $nodeSchema } from '@milkdown/kit/utils'
import katex from 'katex'

export const mathInlineId = 'math_inline'
export const MAX_INLINE_LATEX_VALUE_CHARS = 10_000

export function normalizeInlineLatexValue(value: unknown) {
  return typeof value === 'string' && value.length <= MAX_INLINE_LATEX_VALUE_CHARS
    ? value
    : ''
}

/// Schema for inline math node.
/// Add support for:
///
/// ```markdown
/// $a^2 + b^2 = c^2$
/// ```
export const mathInlineSchema = $nodeSchema(mathInlineId, () => ({
  group: 'inline',
  inline: true,
  draggable: true,
  atom: true,
  attrs: {
    value: {
      default: '',
    },
  },
  parseDOM: [
    {
      tag: `span[data-type="${mathInlineId}"]`,
      getAttrs: (dom) => {
        return {
          value: normalizeInlineLatexValue((dom as HTMLElement).dataset.value),
        }
      },
    },
  ],
  toDOM: (node) => {
    const code: string = node.attrs.value
    const dom = document.createElement('span')
    dom.dataset.type = mathInlineId
    dom.dataset.value = code
    katex.render(code, dom, {
      throwOnError: false,
    })

    return dom
  },
  parseMarkdown: {
    match: (node) => node.type === 'inlineMath',
    runner: (state, node, type) => {
      state.addNode(type, { value: normalizeInlineLatexValue(node.value) })
    },
  },
  toMarkdown: {
    match: (node) => node.type.name === mathInlineId,
    runner: (state, node) => {
      state.addNode('inlineMath', undefined, node.attrs.value)
    },
  },
}))
