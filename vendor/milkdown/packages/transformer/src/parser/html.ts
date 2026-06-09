import type { MarkdownNode } from '../utility'

const HTML_OPEN_TAG_PATTERN = /^<([A-Za-z][A-Za-z0-9-]*)(?:\s[^>]*)?>$/
const HTML_CLOSE_TAG_PATTERN = /^<\/([A-Za-z][A-Za-z0-9-]*)\s*>$/
const HTML_SELF_CLOSING_PATTERN = /\/>$/
const GFM_BLOCK_HTML_TAG_PATTERN =
  /^<\/?(?:address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|nav|noframes|ol|optgroup|option|p|param|search|section|source|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul)(?:\s|\/?>|$)/i
const GFM_TYPE_1_HTML_BLOCK_PATTERN = /^<(?:script|pre|style)(?:\s|>|$)/i
const GFM_TYPE_7_HTML_TAG_LINE_PATTERN = /^<\/?([A-Za-z][A-Za-z0-9-]*)(?:\s[^>]*)?\/?>\s*$/
const GFM_TYPE_7_EXCLUDED_TAGS = new Set(['script', 'style', 'pre'])
const LOCALLY_PARSED_HTML_BLOCK_EXCLUDED_TAGS = new Set(['img'])
const LOCALLY_PARSED_HTML_TAGS = new Set(['sup', 'sub', 'mark', 'u'])
const RAW_HTML_TAG_TEXT_PATTERN = /<\/?[A-Za-z][A-Za-z0-9:-]*(?:\s[^<>]*)?>|&lt;\/?[A-Za-z][A-Za-z0-9:-]*(?:\s[^&<>]*)?&gt;/i
export const MAX_INLINE_HTML_MERGE_AST_NODES = 20_000
export const MAX_INLINE_HTML_MERGE_DEPTH = 200
export const MAX_INLINE_HTML_MERGE_CHILDREN = 5_000

interface InlineHtmlMergeContext {
  visitedNodes: number
}

function hasInlineHtmlMergeBudget(context: InlineHtmlMergeContext, depth: number): boolean {
  context.visitedNodes += 1
  return context.visitedNodes <= MAX_INLINE_HTML_MERGE_AST_NODES
    && depth <= MAX_INLINE_HTML_MERGE_DEPTH
}

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

function hasMarkdownInlineSyntax(nodes: MarkdownNode[]): boolean {
  return nodes.some((node) => {
    if (node.type !== 'text' && node.type !== 'html')
      return true
    return Array.isArray(node.children) && hasMarkdownInlineSyntax(node.children)
  })
}

function hasStrongInlineSyntax(nodes: MarkdownNode[]): boolean {
  return nodes.some((node) => {
    if (node.type === 'strong')
      return true
    return Array.isArray(node.children) && hasStrongInlineSyntax(node.children)
  })
}

function hasRawHtmlTagText(nodes: MarkdownNode[]): boolean {
  return nodes.some((node) => {
    if (
      (node.type === 'text' || node.type === 'html') &&
      RAW_HTML_TAG_TEXT_PATTERN.test(String(node.value ?? ''))
    )
      return true
    return Array.isArray(node.children) && hasRawHtmlTagText(node.children)
  })
}

function getSourceSlice(
  markdown: string | undefined,
  startNode: MarkdownNode,
  endNode: MarkdownNode
): string | null {
  const start = startNode.position?.start?.offset
  const end = endNode.position?.end?.offset
  if (
    !markdown ||
    typeof start !== 'number' ||
    typeof end !== 'number' ||
    start < 0 ||
    end <= start ||
    end > markdown.length
  )
    return null

  return markdown.slice(start, end)
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

function restoreRawHtmlFromSource(node: MarkdownNode, markdown?: string): MarkdownNode {
  if (node.type !== 'html' || !RAW_HTML_TAG_TEXT_PATTERN.test(String(node.value ?? '')))
    return node

  const rawSource = getSourceSlice(markdown, node, node)
  return rawSource ? ({ ...node, value: rawSource } as MarkdownNode) : node
}

function buildInlineHtmlLookup(children: MarkdownNode[]): {
  htmlValues: string[]
  matchingCloseIndexes: number[]
} {
  const htmlValues: string[] = []
  const matchingCloseIndexes: number[] = []
  const openIndexesByTag = new Map<string, number[]>()
  for (let index = 0; index < children.length; index += 1) {
    const child = children[index]
    if (child?.type !== 'html') continue

    const value = String(child.value ?? '').trim()
    htmlValues[index] = value

    const closeMatch = HTML_CLOSE_TAG_PATTERN.exec(value)
    if (closeMatch) {
      const tagName = closeMatch[1]?.toLowerCase()
      const openIndexes = tagName ? openIndexesByTag.get(tagName) : undefined
      const openIndex = openIndexes?.pop()
      if (openIndex !== undefined) matchingCloseIndexes[openIndex] = index
      continue
    }

    const openMatch = HTML_OPEN_TAG_PATTERN.exec(value)
    const tagName = openMatch?.[1]?.toLowerCase()
    if (!tagName || HTML_SELF_CLOSING_PATTERN.test(value)) continue
    const openIndexes = openIndexesByTag.get(tagName)
    if (openIndexes) openIndexes.push(index)
    else openIndexesByTag.set(tagName, [index])
  }
  return { htmlValues, matchingCloseIndexes }
}

export function mergePairedInlineHtml(node: MarkdownNode, markdown?: string): MarkdownNode {
  return mergePairedInlineHtmlWithBudget(node, markdown, { visitedNodes: 0 }, 0)
}

function mergePairedInlineHtmlWithBudget(
  node: MarkdownNode,
  markdown: string | undefined,
  context: InlineHtmlMergeContext,
  depth: number
): MarkdownNode {
  if (!hasInlineHtmlMergeBudget(context, depth)) return node
  if (!Array.isArray(node.children)) return restoreRawHtmlFromSource(node, markdown)
  if (node.children.length > MAX_INLINE_HTML_MERGE_CHILDREN) return node

  node.children = node.children.map((child) => mergePairedInlineHtmlWithBudget(child, markdown, context, depth + 1))

  const { htmlValues, matchingCloseIndexes } = buildInlineHtmlLookup(node.children)
  const mergedChildren: MarkdownNode[] = []
  for (let index = 0; index < node.children.length; index += 1) {
    const child = node.children[index]
    const value = child?.type === 'html' ? htmlValues[index] ?? '' : ''
    const openTagMatch = HTML_OPEN_TAG_PATTERN.exec(value)
    if (!openTagMatch || HTML_SELF_CLOSING_PATTERN.test(value)) {
      mergedChildren.push(child)
      continue
    }

    const tagName = openTagMatch[1]?.toLowerCase()
    if (!tagName) {
      mergedChildren.push(child)
      continue
    }
    const closeIndex = matchingCloseIndexes[index] ?? -1

    if (closeIndex < 0) {
      mergedChildren.push(child)
      continue
    }

    const innerNodes = node.children.slice(index + 1, closeIndex)
    const pairedSource = getSourceSlice(markdown, child, node.children[closeIndex])
    if (pairedSource?.includes('\n') && isGfmHtmlBlock(pairedSource)) {
      mergedChildren.push({
        type: 'html',
        value: pairedSource,
      } as MarkdownNode)
      index = closeIndex
      continue
    }

    const rawSource = hasRawHtmlTagText(innerNodes)
      ? pairedSource
      : null
    if (rawSource) {
      mergedChildren.push({
        type: 'html',
        value: rawSource,
      } as MarkdownNode)
      index = closeIndex
      continue
    }

    if (LOCALLY_PARSED_HTML_TAGS.has(tagName)) {
      mergedChildren.push(child)
      continue
    }
    if (tagName === 'span') {
      const hasStyle = /\sstyle\s*=|^<span\s+style\s*=/i.test(value)
      const hasMarkdown = hasMarkdownInlineSyntax(innerNodes)
      if ((!hasStyle && !hasMarkdown) || (hasStyle && hasMarkdown && !hasStrongInlineSyntax(innerNodes))) {
        mergedChildren.push(child)
        continue
      }
    }

    const innerHtmlParts = innerNodes.map(markdownInlineNodeToHtml)
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
