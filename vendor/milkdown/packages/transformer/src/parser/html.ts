import type { MarkdownNode } from '../utility'

const HTML_OPEN_TAG_PATTERN = /^<([A-Za-z][A-Za-z0-9-]*)(?:\s[^>]*)?>$/
const HTML_SELF_CLOSING_PATTERN = /\/>$/
const GFM_BLOCK_HTML_TAG_PATTERN =
  /^<\/?(?:address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|nav|noframes|ol|optgroup|option|p|param|section|source|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul)(?:\s|\/?>|$)/i
const GFM_TYPE_1_HTML_BLOCK_PATTERN = /^<(?:script|pre|style)(?:\s|>|$)/i
const GFM_TYPE_7_HTML_TAG_LINE_PATTERN = /^<\/?([A-Za-z][A-Za-z0-9-]*)(?:\s[^>]*)?\/?>\s*$/
const GFM_TYPE_7_EXCLUDED_TAGS = new Set(['script', 'style', 'pre'])
const LOCALLY_PARSED_HTML_BLOCK_EXCLUDED_TAGS = new Set(['img'])
const LOCALLY_PARSED_HTML_TAGS = new Set(['sup', 'sub', 'span', 'mark', 'u'])

function escapeHtmlText(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function markdownInlineNodeToHtml(node: MarkdownNode): string | null {
  if (node.type === 'text') return escapeHtmlText(String(node.value ?? ''))
  if (node.type === 'html') return String(node.value ?? '')
  if (node.type === 'inlineCode') return `<code>${escapeHtmlText(String(node.value ?? ''))}</code>`
  if (node.type === 'emphasis' || node.type === 'strong' || node.type === 'delete') {
    const tag = node.type === 'emphasis' ? 'em' : node.type === 'strong' ? 'strong' : 'del'
    const children = (node.children ?? []).map(markdownInlineNodeToHtml)
    if (children.some((child) => child === null)) return null
    return `<${tag}>${children.join('')}</${tag}>`
  }
  return null
}

function isGfmHtmlBlock(value: string): boolean {
  const firstLine = value.trim().split(/\r?\n/, 1)[0]?.trim() ?? ''
  if (GFM_TYPE_1_HTML_BLOCK_PATTERN.test(firstLine)) return true
  if (firstLine.startsWith('<!--')) return true
  if (firstLine.startsWith('<?')) return true
  if (/^<![A-Z]/.test(firstLine)) return true
  if (firstLine.startsWith('<![CDATA[')) return true
  if (GFM_BLOCK_HTML_TAG_PATTERN.test(firstLine)) return true

  const tagLineMatch = GFM_TYPE_7_HTML_TAG_LINE_PATTERN.exec(firstLine)
  const tagName = tagLineMatch?.[1]?.toLowerCase()
  return Boolean(
    tagName
    && !GFM_TYPE_7_EXCLUDED_TAGS.has(tagName)
    && !LOCALLY_PARSED_HTML_BLOCK_EXCLUDED_TAGS.has(tagName)
  )
}

function markGfmHtmlBlock(node: MarkdownNode): MarkdownNode {
  if (node.type !== 'html') return node
  return isGfmHtmlBlock(String(node.value ?? ''))
    ? ({ ...node, githubHtmlBlock: true } as MarkdownNode)
    : node
}

export function mergePairedInlineHtml(node: MarkdownNode): MarkdownNode {
  if (!Array.isArray(node.children)) return node

  node.children = node.children.map(mergePairedInlineHtml)

  const mergedChildren: MarkdownNode[] = []
  for (let index = 0; index < node.children.length; index += 1) {
    const child = node.children[index]
    const value = child?.type === 'html' ? String(child.value ?? '').trim() : ''
    const openTagMatch = HTML_OPEN_TAG_PATTERN.exec(value)
    if (!openTagMatch || HTML_SELF_CLOSING_PATTERN.test(value)) {
      mergedChildren.push(child)
      continue
    }

    const tagName = openTagMatch[1]?.toLowerCase()
    if (!tagName || LOCALLY_PARSED_HTML_TAGS.has(tagName)) {
      mergedChildren.push(child)
      continue
    }
    const closeTag = `</${tagName}>`
    let closeIndex = -1
    for (let cursor = index + 1; cursor < node.children.length; cursor += 1) {
      const candidate = node.children[cursor]
      if (candidate?.type === 'html' && String(candidate.value ?? '').trim().toLowerCase() === closeTag) {
        closeIndex = cursor
        break
      }
    }

    if (closeIndex < 0) {
      mergedChildren.push(child)
      continue
    }

    const innerHtmlParts = node.children.slice(index + 1, closeIndex).map(markdownInlineNodeToHtml)
    if (innerHtmlParts.some((part) => part === null)) {
      mergedChildren.push(child)
      continue
    }

    mergedChildren.push({
      type: 'html',
      value: `${value}${innerHtmlParts.join('')}${node.children[closeIndex].value}`,
    } as MarkdownNode)
    index = closeIndex
  }

  node.children = mergedChildren
  if (node.type !== 'paragraph')
    node.children = node.children.map(markGfmHtmlBlock)
  if (node.type === 'paragraph' && node.children.length === 1) {
    const child = node.children[0]
    const value = child?.type === 'html' ? String(child.value ?? '').trim() : ''
    if (isGfmHtmlBlock(value))
      return markGfmHtmlBlock(child)
  }
  return node
}
