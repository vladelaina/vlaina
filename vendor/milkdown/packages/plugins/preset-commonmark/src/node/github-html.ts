export const githubAllowedHtmlTags = new Set([
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'br', 'b', 'i', 'strong', 'em', 'a',
  'pre', 'code', 'img', 'tt', 'div', 'ins', 'del', 'sup', 'sub', 'p',
  'picture', 'ol', 'ul', 'table', 'thead', 'tbody', 'tfoot', 'blockquote',
  'dl', 'dt', 'dd', 'kbd', 'q', 'samp', 'var', 'hr', 'ruby', 'rt', 'rp',
  'li', 'tr', 'td', 'th', 's', 'strike', 'summary', 'details', 'caption',
  'figure', 'figcaption', 'abbr', 'bdo', 'cite', 'dfn', 'mark', 'small',
  'source', 'span', 'time', 'wbr',
])

const dropWithContentTags = new Set([
  'script', 'style', 'title', 'textarea', 'xmp', 'iframe', 'noembed',
  'noframes', 'plaintext', 'math', 'noscript', 'svg',
])
const wrapContentWithWhitespaceTags = new Set([
  'address', 'article', 'aside', 'blockquote', 'br', 'dd', 'div', 'dl', 'dt',
  'footer', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hgroup', 'hr',
  'li', 'nav', 'ol', 'p', 'pre', 'section', 'ul',
])
const gfmDisallowedRawHtmlTags = new Set([
  'title', 'textarea', 'style', 'xmp', 'iframe', 'noembed', 'noframes',
  'script', 'plaintext',
])
const gfmDisallowedRawHtmlPattern =
  /<\/?(?:title|textarea|style|xmp|iframe|noembed|noframes|script|plaintext)(?=[\s>/]|$)/gi

const allowedGlobalAttributes = new Set([
  'abbr', 'accept', 'accept-charset', 'accesskey', 'action', 'align', 'alt',
  'aria-describedby', 'aria-hidden', 'aria-label', 'aria-labelledby', 'axis',
  'border', 'char', 'charoff', 'charset', 'checked', 'clear', 'cols',
  'colspan', 'compact', 'coords', 'datetime', 'dir', 'disabled', 'enctype',
  'for', 'frame', 'headers', 'height', 'hreflang', 'hspace', 'id', 'ismap',
  'label', 'lang', 'maxlength', 'media', 'method', 'multiple', 'name',
  'nohref', 'noshade', 'nowrap', 'open', 'progress', 'prompt', 'readonly',
  'rel', 'rev', 'role', 'rows', 'rowspan', 'rules', 'scope', 'selected',
  'shape', 'size', 'span', 'start', 'summary', 'tabindex', 'title', 'type',
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
  source: new Set(['srcset']),
}

const urlAttributesByTag: Record<string, ReadonlySet<string>> = {
  a: new Set(['href']),
  img: new Set(['src', 'longdesc']),
  blockquote: new Set(['cite']),
  del: new Set(['cite']),
  ins: new Set(['cite']),
  q: new Set(['cite']),
}

const srcsetAttributesByTag: Record<string, ReadonlySet<string>> = {
  source: new Set(['srcset']),
}

const gfmBlockHtmlTagPattern =
  /^<\/?(?:address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|nav|noframes|ol|optgroup|option|p|param|section|source|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul)(?:\s|\/?>|$)/i
const gfmType1HtmlBlockPattern = /^<(?:script|pre|style)(?:\s|>|$)/i
const gfmType7HtmlTagLinePattern = /^<\/?([A-Za-z][A-Za-z0-9-]*)(?:\s[^>]*)?\/?>\s*$/
const gfmType7ExcludedTags = new Set(['script', 'style', 'pre'])
const relativeProtocolMarkers = new Set(['#', '/'])
const linkProtocols = new Set(['http:', 'https:', 'mailto:'])
const mediaProtocols = new Set(['http:', 'https:'])
const controlOrBidiPattern = /[\u0000-\u001F\u007F\u202A-\u202E\u2066-\u2069\uFFFD]/
const rawHtmlTagPattern = /^<\/?([A-Za-z][A-Za-z0-9-]*)(?:\s|\/?>|$)/

function parseIPv4(hostname: string) {
  const parts = hostname.split('.')
  if (parts.length !== 4) return null
  const octets = parts.map((part) => Number(part))
  if (octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) return null
  return octets
}

function isLocalNetworkHttpUrl(value: string) {
  try {
    const url = new URL(value, window.location.href)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false
    const hostname = url.hostname.replace(/^\[|\]$/g, '').toLowerCase()
    const ipv4 = parseIPv4(hostname)
    const mappedIPv6 = hostname.startsWith('::ffff:')
      ? hostname.slice('::ffff:'.length).split(':')
      : null
    const mappedIPv4 = mappedIPv6?.length === 2
      ? [
          (Number.parseInt(mappedIPv6[0], 16) >> 8) & 255,
          Number.parseInt(mappedIPv6[0], 16) & 255,
          (Number.parseInt(mappedIPv6[1], 16) >> 8) & 255,
          Number.parseInt(mappedIPv6[1], 16) & 255,
        ]
      : null
    return (
      hostname === 'localhost'
      || hostname === '::1'
      || hostname.startsWith('fe80:')
      || hostname.startsWith('fc')
      || hostname.startsWith('fd')
      || Boolean(mappedIPv4 && (
        mappedIPv4[0] === 0
        || mappedIPv4[0] === 10
        || mappedIPv4[0] === 127
        || (mappedIPv4[0] === 169 && mappedIPv4[1] === 254)
        || (mappedIPv4[0] === 172 && mappedIPv4[1] >= 16 && mappedIPv4[1] <= 31)
        || (mappedIPv4[0] === 192 && mappedIPv4[1] === 168)
      ))
      || Boolean(ipv4 && (
        ipv4[0] === 0
        || ipv4[0] === 10
        || ipv4[0] === 127
        || (ipv4[0] === 169 && ipv4[1] === 254)
        || (ipv4[0] === 172 && ipv4[1] >= 16 && ipv4[1] <= 31)
        || (ipv4[0] === 192 && ipv4[1] === 168)
      ))
    )
  } catch {
    return false
  }
}

function isAllowedAttribute(tagName: string, attributeName: string) {
  if (attributeName.startsWith('on')) return false
  if (attributeName === 'class' || attributeName === 'style') return false
  if (attributeName.startsWith('data-')) return false
  return allowedGlobalAttributes.has(attributeName) || Boolean(allowedAttributesByTag[tagName]?.has(attributeName))
}

function hasProtocol(value: string) {
  return value.includes('://')
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

function normalizeUrl(value: string, protocols: ReadonlySet<string>, options: { blockLocalNetwork?: boolean } = {}) {
  const trimmed = value.trimStart()
  if (!trimmed || controlOrBidiPattern.test(trimmed))
    return null
  const marker = getProtocolMarker(trimmed)
  if (relativeProtocolMarkers.has(marker)) {
    if (options.blockLocalNetwork && trimmed.startsWith('//') && isLocalNetworkHttpUrl(`https:${trimmed}`))
      return null
    return trimmed
  }
  if (!protocols.has(marker)) return null
  if (options.blockLocalNetwork && isLocalNetworkHttpUrl(trimmed)) return null
  return trimmed
}

function isPublicRemoteMediaUrl(value: string) {
  if (!value.startsWith('//') && !/^https?:/i.test(value)) return false
  const normalized = value.startsWith('//') ? `https:${value}` : value
  try {
    const url = new URL(normalized, window.location.href)
    return (
      (url.protocol === 'http:' || url.protocol === 'https:')
      && !isLocalNetworkHttpUrl(normalized)
    )
  } catch {
    return false
  }
}

function normalizeSrcset(value: string) {
  const trimmed = value.trimStart()
  if (!trimmed || controlOrBidiPattern.test(trimmed)) return null
  const candidates = trimmed.split(',').map((candidate) => candidate.trim()).filter(Boolean)
  if (candidates.length === 0) return null
  for (const candidate of candidates) {
    const source = candidate.split(/\s+/, 1)[0]
    if (!source || hasProtocol(source) || source.startsWith('//') || normalizeUrl(source, mediaProtocols, { blockLocalNetwork: true }) !== source)
      return null
  }
  return trimmed
}

function sanitizeChildren(source: Element | DocumentFragment, target: Element | DocumentFragment) {
  for (const child of Array.from(source.childNodes)) {
    const sanitized = sanitizeNode(child)
    if (sanitized) target.appendChild(sanitized)
  }
}

function sanitizeElement(element: Element): Node | null {
  const tagName = element.tagName.toLowerCase()
  const attributeNames = element.getAttributeNames()
  if (dropWithContentTags.has(tagName)) return null
  if (attributeNames.some((attributeName) => attributeName.startsWith('<!--'))) return null
  if (!githubAllowedHtmlTags.has(tagName)) {
    const fragment = document.createDocumentFragment()
    if (wrapContentWithWhitespaceTags.has(tagName))
      fragment.appendChild(document.createTextNode(' '))
    sanitizeChildren(element, fragment)
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

    if (urlAttributesByTag[tagName]?.has(attributeName)) {
      const protocols = tagName === 'a' ? linkProtocols : mediaProtocols
      const normalizedUrl = normalizeUrl(value, protocols, { blockLocalNetwork: tagName !== 'a' })
      if (normalizedUrl && !(tagName === 'img' && isPublicRemoteMediaUrl(normalizedUrl)))
        sanitized.setAttribute(attributeName, normalizedUrl)
      continue
    }
    if (srcsetAttributesByTag[tagName]?.has(attributeName)) {
      const normalizedSrcset = normalizeSrcset(value)
      if (normalizedSrcset) sanitized.setAttribute(attributeName, normalizedSrcset)
      continue
    }
    if (hasProtocol(value)) continue
    sanitized.setAttribute(attributeName, value)
  }
  sanitizeChildren(element, sanitized)
  return sanitized
}

function sanitizeNode(node: Node): Node | null {
  if (node.nodeType === Node.TEXT_NODE)
    return document.createTextNode(node.textContent ?? '')
  if (node.nodeType === Node.ELEMENT_NODE)
    return sanitizeElement(node as Element)
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
  template.innerHTML = value.replace(gfmDisallowedRawHtmlPattern, (tag) => `&lt;${tag.slice(1)}`)
  const output = document.createElement('template')
  sanitizeChildren(template.content, output.content)
  return output.innerHTML
}
