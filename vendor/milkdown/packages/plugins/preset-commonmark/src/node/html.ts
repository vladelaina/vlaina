import { $nodeAttr, $nodeSchema } from '@milkdown/utils'

import { withMeta } from '../__internal__'
import { isGfmDisallowedRawHtml, isGithubHtmlBlock, sanitizeGithubHtml } from './github-html'

export const htmlAttr = $nodeAttr('html')

function isGithubHtmlBlockNode(node: { githubHtmlBlock?: unknown; value?: unknown }) {
  const value = String(node.value ?? '')
  return node.githubHtmlBlock === true || (value.includes('\n') && isGithubHtmlBlock(value))
}

withMeta(htmlAttr, {
  displayName: 'Attr<html>',
  group: 'Html',
})

export const htmlSchema = $nodeSchema('html', (ctx) => {
  return {
    atom: true,
    group: 'inline',
    inline: true,
    attrs: {
      value: {
        default: '',
        validate: 'string',
      },
    },
    toDOM: (node) => {
      const span = document.createElement('span')
      Object.entries({
        ...ctx.get(htmlAttr.key)(node),
        'data-value': node.attrs.value,
        'data-type': 'html',
      }).forEach(([key, value]) => {
        if (value != null) span.setAttribute(key, String(value))
      })
      span.innerHTML = sanitizeGithubHtml(node.attrs.value)
      if (span.childNodes.length === 0 && isGfmDisallowedRawHtml(node.attrs.value))
        span.textContent = node.attrs.value
      return span
    },
    parseDOM: [
      {
        tag: 'span[data-type="html"]',
        getAttrs: (dom) => {
          return {
            value: dom.dataset.value ?? '',
          }
        },
      },
    ],
    parseMarkdown: {
      match: (node) => node.type === 'html' && !isGithubHtmlBlockNode(node),
      runner: (state, node, type) => {
        state.addNode(type, { value: node.value as string })
      },
    },
    toMarkdown: {
      match: (node) => node.type.name === 'html',
      runner: (state, node) => {
        state.addNode('html', undefined, node.attrs.value)
      },
    },
  }
})

export const htmlBlockSchema = $nodeSchema('html_block', (ctx) => {
  return {
    atom: true,
    group: 'block',
    attrs: {
      value: {
        default: '',
        validate: 'string',
      },
    },
    toDOM: (node) => {
      const block = document.createElement('div')
      Object.entries({
        ...ctx.get(htmlAttr.key)(node),
        'data-value': node.attrs.value,
        'data-type': 'html-block',
      }).forEach(([key, value]) => {
        if (value != null) block.setAttribute(key, String(value))
      })
      block.innerHTML = sanitizeGithubHtml(node.attrs.value)
      if (block.childNodes.length === 0 && isGfmDisallowedRawHtml(node.attrs.value))
        block.textContent = node.attrs.value
      return block
    },
    parseDOM: [
      {
        tag: 'div[data-type="html-block"]',
        getAttrs: (dom) => {
          return {
            value: dom.dataset.value ?? '',
          }
        },
      },
    ],
    parseMarkdown: {
      match: (node) => node.type === 'html' && isGithubHtmlBlockNode(node),
      runner: (state, node, type) => {
        state.addNode(type, { value: node.value as string })
      },
    },
    toMarkdown: {
      match: (node) => node.type.name === 'html_block',
      runner: (state, node) => {
        state.addNode('html', undefined, node.attrs.value)
      },
    },
  }
})

withMeta(htmlSchema.node, {
  displayName: 'NodeSchema<html>',
  group: 'Html',
})

withMeta(htmlSchema.ctx, {
  displayName: 'NodeSchemaCtx<html>',
  group: 'Html',
})

withMeta(htmlBlockSchema.node, {
  displayName: 'NodeSchema<htmlBlock>',
  group: 'Html',
})

withMeta(htmlBlockSchema.ctx, {
  displayName: 'NodeSchemaCtx<htmlBlock>',
  group: 'Html',
})
