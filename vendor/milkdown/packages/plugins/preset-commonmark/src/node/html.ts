import { $nodeAttr, $nodeSchema } from '@milkdown/utils'

import { withMeta } from '../__internal__'
import {
  isGfmDisallowedRawHtml,
  isGithubHtmlBlock,
  maxGithubHtmlSanitizeChars,
  sanitizeGithubHtml,
} from './github-html'

export const htmlAttr = $nodeAttr('html')

function isGithubHtmlBlockNode(node: { githubHtmlBlock?: unknown; value?: unknown }) {
  const value = typeof node.value === 'string' ? node.value : ''
  return node.githubHtmlBlock === true || (value.includes('\n') && isGithubHtmlBlock(value))
}

function getBoundedHtmlValue(value: unknown) {
  const html = typeof value === 'string' ? value : ''
  return html.length <= maxGithubHtmlSanitizeChars ? html : ''
}

function getSafeDomAttributeValue(value: unknown) {
  if (typeof value === 'string' || typeof value === 'boolean')
    return String(value)
  if (typeof value === 'number' && Number.isFinite(value))
    return String(value)
  return null
}

function setSafeDomAttributes(element: HTMLElement, attrs: Record<string, unknown>) {
  Object.entries(attrs).forEach(([key, value]) => {
    const attrValue = getSafeDomAttributeValue(value)
    if (attrValue != null) element.setAttribute(key, attrValue)
  })
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
      const value = getBoundedHtmlValue(node.attrs.value)
      setSafeDomAttributes(span, {
        ...ctx.get(htmlAttr.key)(node),
        'data-value': value,
        'data-type': 'html',
      })
      span.innerHTML = sanitizeGithubHtml(value)
      if (span.childNodes.length === 0 && isGfmDisallowedRawHtml(value))
        span.textContent = value
      return span
    },
    parseDOM: [
      {
        tag: 'span[data-type="html"]',
        getAttrs: (dom) => {
          return {
            value: getBoundedHtmlValue(dom.dataset.value),
          }
        },
      },
    ],
    parseMarkdown: {
      match: (node) => node.type === 'html' && !isGithubHtmlBlockNode(node),
      runner: (state, node, type) => {
        state.addNode(type, { value: getBoundedHtmlValue(node.value) })
      },
    },
    toMarkdown: {
      match: (node) => node.type.name === 'html',
      runner: (state, node) => {
        state.addNode('html', undefined, getBoundedHtmlValue(node.attrs.value))
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
      const value = getBoundedHtmlValue(node.attrs.value)
      setSafeDomAttributes(block, {
        ...ctx.get(htmlAttr.key)(node),
        'data-value': value,
        'data-type': 'html-block',
      })
      block.innerHTML = sanitizeGithubHtml(value)
      if (block.childNodes.length === 0 && isGfmDisallowedRawHtml(value))
        block.textContent = value
      return block
    },
    parseDOM: [
      {
        tag: 'div[data-type="html-block"]',
        getAttrs: (dom) => {
          return {
            value: getBoundedHtmlValue(dom.dataset.value),
          }
        },
      },
    ],
    parseMarkdown: {
      match: (node) => node.type === 'html' && isGithubHtmlBlockNode(node),
      runner: (state, node, type) => {
        state.addNode(type, { value: getBoundedHtmlValue(node.value) })
      },
    },
    toMarkdown: {
      match: (node) => node.type.name === 'html_block',
      runner: (state, node) => {
        state.addNode('html', undefined, getBoundedHtmlValue(node.attrs.value))
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
