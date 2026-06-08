import { hasInternalImageUrlPathSegment, isLocalNetworkHttpUrl } from '../__internal__'
import { prepareGithubRawHtmlForSanitizer } from './github-raw-html'

export const githubAllowedHtmlTags = new Set([
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'br', 'b', 'i', 'strong', 'em', 'a',
  'pre', 'code', 'img', 'tt', 'div', 'ins', 'del', 'sup', 'sub', 'p',
  'picture', 'ol', 'ul', 'table', 'thead', 'tbody', 'tfoot', 'blockquote',
  'dl', 'dt', 'dd', 'kbd', 'q', 'samp', 'var', 'hr', 'ruby', 'rt', 'rp',
  'li', 'tr', 'td', 'th', 's', 'strike', 'summary', 'details', 'caption',
  'figure', 'figcaption', 'abbr', 'bdo', 'cite', 'dfn', 'mark', 'small',
  'source', 'span', 'time', 'wbr', 'video', 'audio', 'iframe', 'track',
])

const dropWithContentTags = new Set([
  'script', 'style', 'title', 'textarea', 'xmp', 'noembed',
  'noframes', 'plaintext', 'math', 'noscript', 'svg',
])
const wrapContentWithWhitespaceTags = new Set([
  'address', 'article', 'aside', 'blockquote', 'br', 'dd', 'div', 'dl', 'dt',
  'footer', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hgroup', 'hr',
  'li', 'nav', 'ol', 'p', 'pre', 'section', 'ul',
])
export const gfmDisallowedRawHtmlTags = new Set([
  'title', 'textarea', 'style', 'xmp', 'noembed', 'noframes',
  'script', 'plaintext',
])
export const sanitizerOnlyDropWithContentTags = new Set(['math', 'noscript', 'svg'])

const allowedGlobalAttributes = new Set([
  'abbr', 'accept', 'accept-charset', 'accesskey', 'action', 'align', 'alt',
  'aria-describedby', 'aria-hidden', 'aria-label', 'aria-labelledby', 'axis',
  'border', 'char', 'charoff', 'charset', 'checked', 'clear', 'cols',
  'colspan', 'compact', 'coords', 'datetime', 'dir', 'disabled', 'enctype',
  'for', 'frame', 'headers', 'height', 'hreflang', 'hspace', 'ismap',
  'label', 'lang', 'maxlength', 'media', 'method', 'multiple', 'name',
  'nohref', 'noshade', 'nowrap', 'open', 'progress', 'prompt', 'readonly',
  'rel', 'rev', 'role', 'rows', 'rowspan', 'rules', 'scope', 'selected',
  'shape', 'size', 'span', 'start', 'style', 'summary', 'tabindex', 'title', 'type',
  'usemap', 'valign', 'value', 'width', 'itemprop',
])

const allowedAttributesByTag: Record<string, ReadonlySet<string>> = {
  a: new Set(['href']),
  img: new Set(['src', 'longdesc', 'loading', 'alt']),
  div: new Set(['itemscope', 'itemtype']),
  blockquote: new Set(['cite']),
  del: new Set(['cite']),
  ins: new Set(['cite']),
  q: new Set(['cite']),
  source: new Set(['src', 'srcset', 'type', 'media']),
  video: new Set(['src', 'poster', 'controls', 'autoplay', 'loop', 'muted', 'preload', 'playsinline']),
  audio: new Set(['src', 'controls', 'autoplay', 'loop', 'muted', 'preload']),
  track: new Set(['src', 'kind', 'srclang', 'label', 'default']),
  iframe: new Set([
    'src', 'sandbox', 'allow', 'allowfullscreen', 'allowtransparency',
    'frameborder', 'scrolling', 'referrerpolicy', 'loading',
  ]),
}

const urlAttributesByTag: Record<string, ReadonlySet<string>> = {
  a: new Set(['href']),
  img: new Set(['src', 'longdesc']),
  blockquote: new Set(['cite']),
  del: new Set(['cite']),
  ins: new Set(['cite']),
  q: new Set(['cite']),
  source: new Set(['src']),
  video: new Set(['src', 'poster']),
  audio: new Set(['src']),
  track: new Set(['src']),
  iframe: new Set(['src']),
}

const srcsetAttributesByTag: Record<string, ReadonlySet<string>> = {
  source: new Set(['srcset']),
}

const gfmBlockHtmlTagPattern =
  /^<\/?(?:address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|nav|noframes|ol|optgroup|option|p|param|search|section|source|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul)(?:\s|\/?>|$)/i
const gfmType1HtmlBlockPattern = /^<(?:script|pre|style)(?:\s|>|$)/i
const gfmType7HtmlTagLinePattern = /^<\/?([A-Za-z][A-Za-z0-9-]*)(?:\s[^>]*)?\/?>\s*$/
const gfmType7ExcludedTags = new Set(['script', 'style', 'pre'])
const relativeProtocolMarkers = new Set(['#', '/'])
const linkProtocols = new Set(['http:', 'https:', 'mailto:'])
const mediaProtocols = new Set(['http:', 'https:'])
const controlOrBidiPattern = /[\u0000-\u001F\u007F\u202A-\u202E\u2066-\u2069\uFFFD]/
const rawHtmlTagPattern = /^<\/?([A-Za-z][A-Za-z0-9-]*)(?:\s|\/?>|$)/
const forcedIframeSandbox = 'allow-scripts'
const allowedIframeSandboxTokens = new Set(['allow-scripts', 'allow-forms', 'allow-popups', 'allow-presentation'])
const allowedStyleProperties = new Set([
  'background',
  'background-color',
  'border',
  'border-color',
  'border-radius',
  'border-style',
  'border-width',
  'color',
  'display',
  'font-size',
  'font-style',
  'font-weight',
  'height',
  'line-height',
  'margin',
  'margin-bottom',
  'margin-left',
  'margin-right',
  'margin-top',
  'max-height',
  'max-width',
  'min-height',
  'min-width',
  'opacity',
  'padding',
  'padding-bottom',
  'padding-left',
  'padding-right',
  'padding-top',
  'text-align',
  'text-decoration',
  'vertical-align',
  'width',
])
const srcsetDescriptorPattern = /^\d+(?:\.\d+)?(?:w|x)$/
const maxGithubHtmlAttributeValueChars = 16 * 1024
const maxGithubSrcsetCandidates = 128
const maxSanitizeDepth = 200
const maxSanitizeNodes = 20_000

interface SanitizeContext {
  visitedNodes: number
}

function canVisitNode(context: SanitizeContext) {
  context.visitedNodes += 1
  return context.visitedNodes <= maxSanitizeNodes
}

function hasSanitizeBudget(context: SanitizeContext) {
  return context.visitedNodes < maxSanitizeNodes
}

function isAllowedAttribute(tagName: string, attributeName: string) {
  if (attributeName.startsWith('on')) return false
  if (attributeName === 'class' || attributeName === 'id') return false
  if (attributeName.startsWith('data-')) return false
  return allowedGlobalAttributes.has(attributeName) || Boolean(allowedAttributesByTag[tagName]?.has(attributeName))
}

function isHtmlAttributeValueAllowed(value: string) {
  return value.length <= maxGithubHtmlAttributeValueChars
}

function sanitizeStyle(value: string) {
  if (!isHtmlAttributeValueAllowed(value)) return null

  const declarations: string[] = []
  for (const rawDeclaration of value.split(';')) {
    const separatorIndex = rawDeclaration.indexOf(':')
    if (separatorIndex <= 0) continue
    const property = rawDeclaration.slice(0, separatorIndex).trim().toLowerCase()
    const propertyValue = rawDeclaration.slice(separatorIndex + 1).trim()
    if (!allowedStyleProperties.has(property)) continue
    if (!propertyValue || /[\u0000-\u001F\u007F]/.test(propertyValue)) continue
    if (/\\|\/\*|\*\//.test(propertyValue)) continue
    if (/(?:\b(?:url|image-set|cross-fade|paint|expression)|-webkit-image-set)\s*\(|@import|javascript:/i.test(propertyValue)) continue
    declarations.push(`${property}: ${propertyValue}`)
  }
  return declarations.length > 0 ? declarations.join('; ') : null
}

function sanitizeIframeSandbox(value: string | null) {
  const tokens = new Set(forcedIframeSandbox.split(/\s+/).filter(Boolean))
  if (value && !isHtmlAttributeValueAllowed(value))
    return Array.from(tokens).join(' ')

  for (const token of (value ?? '').split(/\s+/)) {
    const normalized = token.trim().toLowerCase()
    if (allowedIframeSandboxTokens.has(normalized))
      tokens.add(normalized)
  }
  return Array.from(tokens).join(' ')
}

function hasProtocol(value: string) {
  return value.includes('://')
}

function hasUnsafeBackslashUrlSyntax(value: string) {
  return value.startsWith('\\') || (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(value) && value.includes('\\'))
}

function getProtocolMarker(value: string) {
  let position = 0
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index]
    if (char !== ':' && char !== '/' && char !== '#' && position + 1 < value.length) {
      position = index + 1
      continue
    }
    break
  }

  const marker = value[position]
  if (marker === '/' || marker === '#') return marker
  return `${value.slice(0, position).toLowerCase()}:`
}

function isSafePlainRelativeMediaUrl(value: string) {
  return (
    !hasProtocol(value)
    && !hasInternalImageUrlPathSegment(value)
    && !/^[A-Za-z][A-Za-z0-9+.-]*:/.test(value)
    && !value.startsWith('//')
    && !value.startsWith('\\')
    && !/^[A-Za-z]:[\\/]/.test(value)
    && !value.startsWith('/')
    && !controlOrBidiPattern.test(value)
  )
}

function normalizeUrl(value: string, protocols: ReadonlySet<string>, options: { blockLocalNetwork?: boolean; allowPlainRelative?: boolean; allowProtocolRelative?: boolean } = {}) {
  if (!isHtmlAttributeValueAllowed(value)) return null

  const trimmed = value.trimStart()
  if (!trimmed || controlOrBidiPattern.test(trimmed))
    return null
  if (hasUnsafeBackslashUrlSyntax(trimmed))
    return null
  const marker = getProtocolMarker(trimmed)
  if (relativeProtocolMarkers.has(marker)) {
    if (trimmed.startsWith('//') && options.allowProtocolRelative === false)
      return null
    if (!trimmed.startsWith('//') && hasInternalImageUrlPathSegment(trimmed))
      return null
    if (options.blockLocalNetwork && trimmed.startsWith('//') && isLocalNetworkHttpUrl(`https:${trimmed}`))
      return null
    if (trimmed.startsWith('//'))
      return `https:${trimmed}`
    if (marker === '/' && !trimmed.startsWith('//') && options.allowPlainRelative && options.blockLocalNetwork && !isSafePlainRelativeMediaUrl(trimmed))
      return null
    return trimmed
  }
  if (options.allowPlainRelative && isSafePlainRelativeMediaUrl(trimmed))
    return trimmed
  if (!protocols.has(marker)) return null
  if (options.blockLocalNetwork && isLocalNetworkHttpUrl(trimmed)) return null
  return trimmed
}

function normalizeSrcset(value: string) {
  if (!isHtmlAttributeValueAllowed(value)) return null

  const trimmed = value.trimStart()
  if (!trimmed || controlOrBidiPattern.test(trimmed)) return null
  const candidates = trimmed.split(',').map((candidate) => candidate.trim()).filter(Boolean)
  if (candidates.length === 0 || candidates.length > maxGithubSrcsetCandidates) return null
  for (const candidate of candidates) {
    const [source, ...descriptors] = candidate.split(/\s+/).filter(Boolean)
    if (!source || hasProtocol(source) || source.startsWith('//') || normalizeUrl(source, mediaProtocols, { blockLocalNetwork: true, allowPlainRelative: true }) !== source)
      return null
    if (descriptors.length > 1 || (descriptors[0] && !srcsetDescriptorPattern.test(descriptors[0])))
      return null
  }
  return trimmed
}

function sanitizeChildren(source: Element | DocumentFragment, target: Element | DocumentFragment, context: SanitizeContext, depth: number) {
  for (let child = source.firstChild; child && hasSanitizeBudget(context); child = child.nextSibling) {
    const sanitized = sanitizeNode(child, context, depth)
    if (sanitized) target.appendChild(sanitized)
  }
}

function sanitizeElement(element: Element, context: SanitizeContext, depth: number): Node | null {
  if (depth > maxSanitizeDepth)
    return null

  const tagName = element.tagName.toLowerCase()
  const attributeNames = element.getAttributeNames()
  if (dropWithContentTags.has(tagName)) return null
  if (attributeNames.some((attributeName) => attributeName.startsWith('<!--'))) return null
  if (!githubAllowedHtmlTags.has(tagName)) {
    const fragment = document.createDocumentFragment()
    if (wrapContentWithWhitespaceTags.has(tagName))
      fragment.appendChild(document.createTextNode(' '))
    sanitizeChildren(element, fragment, context, depth + 1)
    if (wrapContentWithWhitespaceTags.has(tagName))
      fragment.appendChild(document.createTextNode(' '))
    return fragment
  }

  const sanitized = document.createElement(tagName)
  for (const name of attributeNames) {
    const attributeName = name.toLowerCase()
    if (!isAllowedAttribute(tagName, attributeName)) continue
    const value = element.getAttribute(name)
    if (value === null) continue

    if (attributeName === 'style') {
      const sanitizedStyle = sanitizeStyle(value)
      if (sanitizedStyle)
        sanitized.setAttribute('style', sanitizedStyle)
      continue
    }

    if (urlAttributesByTag[tagName]?.has(attributeName)) {
      const protocols = tagName === 'a' ? linkProtocols : mediaProtocols
      const normalizedUrl = normalizeUrl(value, protocols, {
        allowPlainRelative: true,
        allowProtocolRelative: tagName !== 'a',
        blockLocalNetwork: tagName !== 'a',
      })
      if (normalizedUrl)
        sanitized.setAttribute(attributeName, normalizedUrl)
      continue
    }
    if (srcsetAttributesByTag[tagName]?.has(attributeName)) {
      const normalizedSrcset = normalizeSrcset(value)
      if (normalizedSrcset) sanitized.setAttribute(attributeName, normalizedSrcset)
      continue
    }
    if (!isHtmlAttributeValueAllowed(value)) continue
    if (hasProtocol(value)) continue
    sanitized.setAttribute(attributeName, value)
  }
  if (tagName === 'iframe') {
    if (!sanitized.hasAttribute('src'))
      return null
    sanitized.setAttribute('sandbox', sanitizeIframeSandbox(element.getAttribute('sandbox')))
    if (!sanitized.hasAttribute('referrerpolicy'))
      sanitized.setAttribute('referrerpolicy', 'no-referrer')
  }
  sanitizeChildren(element, sanitized, context, depth + 1)
  if ((tagName === 'video' || tagName === 'audio') && !sanitized.hasAttribute('src') && !sanitized.querySelector('source[src]'))
    return null
  return sanitized
}

function sanitizeNode(node: Node, context: SanitizeContext, depth: number): Node | null {
  if (!canVisitNode(context))
    return null

  if (node.nodeType === Node.TEXT_NODE)
    return document.createTextNode(node.textContent ?? '')
  if (node.nodeType === Node.ELEMENT_NODE)
    return sanitizeElement(node as Element, context, depth)
  return null
}

export function isGithubHtmlBlock(value: string) {
  const trimmed = value.trim()
  if (!trimmed.includes('\n')) return false

  const firstLine = trimmed.split(/\r?\n/, 1)[0]?.trim() ?? ''
  if (gfmType1HtmlBlockPattern.test(firstLine)) return true
  if (firstLine.startsWith('<!--')) return true
  if (firstLine.startsWith('<?')) return true
  if (/^<![A-Z]/.test(firstLine)) return true
  if (firstLine.startsWith('<![CDATA[')) return true
  if (gfmBlockHtmlTagPattern.test(firstLine)) return true

  const tagLineMatch = gfmType7HtmlTagLinePattern.exec(firstLine)
  return Boolean(tagLineMatch?.[1] && !gfmType7ExcludedTags.has(tagLineMatch[1].toLowerCase()))
}

export function isGfmDisallowedRawHtml(value: string) {
  const match = rawHtmlTagPattern.exec(value.trim())
  return Boolean(match?.[1] && gfmDisallowedRawHtmlTags.has(match[1].toLowerCase()))
}

export function sanitizeGithubHtml(value: string) {
  const template = document.createElement('template')
  template.innerHTML = prepareGithubRawHtmlForSanitizer(value, {
    gfmDisallowedRawHtmlTags,
    sanitizerOnlyDropWithContentTags,
  })
  const output = document.createElement('template')
  sanitizeChildren(template.content, output.content, { visitedNodes: 0 }, 1)
  return output.innerHTML
}
