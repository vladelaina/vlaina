const controlOrBidiPattern = /[\u0000-\u001F\u007F\u202A-\u202E\u2066-\u2069\uFFFD]/
const schemePattern = /^([A-Za-z][A-Za-z0-9+.-]*):/
const windowsAbsolutePathPattern = /^[A-Za-z]:[\\/]/
const unixAbsolutePathPattern = /^\//
const safeMediaSchemes = new Set(['http:', 'https:', 'blob:'])
const fallbackUrlBase = 'https://milkdown.local/'
const safeDataImagePattern = /^(data:image\/(?:png|jpeg|jpg|webp|gif|bmp|avif);base64,)([A-Za-z0-9+/=]+)$/i
const maxInlineImageBytes = 10 * 1024 * 1024
const maxInlineImageBase64Chars = Math.ceil(maxInlineImageBytes / 3) * 4
const maxRemoteMediaUrlChars = 16 * 1024
const maxInternalImageSrcChars = 16 * 1024
const internalImagePathSegments = new Set(['.vlaina', '.git'])
const maxInternalImageUrlDecodeDepth = 3

function getUrlBase() {
  return typeof window !== 'undefined' ? window.location.href : fallbackUrlBase
}

function hasUnsafeBackslashUrlSyntax(value: string) {
  return value.startsWith('\\') || (schemePattern.test(value) && value.includes('\\'))
}

function hasInternalImagePathSegment(path: string) {
  return path
    .replace(/\\/g, '/')
    .split('/')
    .some((segment) => internalImagePathSegments.has(segment.toLowerCase()))
}

function decodeUrlPathCandidate(path: string) {
  try {
    return decodeURIComponent(path)
  } catch {
    return null
  }
}

export function hasInternalImageUrlPathSegment(path: string) {
  let pathCandidate = path.split(/[?#]/, 1)[0] ?? ''
  for (let depth = 0; depth < maxInternalImageUrlDecodeDepth; depth += 1) {
    if (hasInternalImagePathSegment(pathCandidate)) return true

    const decoded = decodeUrlPathCandidate(pathCandidate)
    if (!decoded || decoded === pathCandidate) return false
    pathCandidate = decoded
  }

  return hasInternalImagePathSegment(pathCandidate)
}

function getBase64DecodedByteLength(payload: string) {
  if (payload.length % 4 === 1 || !/^[A-Za-z0-9+/]*={0,2}$/.test(payload)) return null

  let padding = 0
  if (payload.endsWith('==')) padding = 2
  else if (payload.endsWith('=')) padding = 1

  const byteLength = Math.floor((payload.length * 3) / 4) - padding
  return byteLength >= 0 ? byteLength : null
}

function parseIPv4(hostname: string) {
  const parts = hostname.split('.')
  if (parts.length !== 4) return null
  const octets = parts.map((part) => Number(part))
  if (octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) return null
  return octets
}

function isPrivateIPv4(hostname: string) {
  const ipv4 = parseIPv4(hostname)
  if (!ipv4) return false
  const [a, b] = ipv4
  return (
    a === 0
    || a === 10
    || a === 127
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168)
    || (a === 198 && (b === 18 || b === 19))
    || a >= 224
  )
}

function parseEmbeddedIPv4Hextets(parts: string[]) {
  if (parts.length !== 2) return null
  if (parts.some((part) => !/^[\da-f]{1,4}$/i.test(part))) return null

  const high = Number.parseInt(parts[0], 16)
  const low = Number.parseInt(parts[1], 16)
  if (!Number.isFinite(high) || !Number.isFinite(low)) return null

  return [
    (high >> 8) & 255,
    high & 255,
    (low >> 8) & 255,
    low & 255,
  ].join('.')
}

function hasPrivateEmbeddedIPv4(normalized: string, prefix: string) {
  if (!normalized.startsWith(prefix)) return false
  const embedded = parseEmbeddedIPv4Hextets(normalized.slice(prefix.length).split(':'))
  return embedded ? isPrivateIPv4(embedded) : false
}

function isLocalNetworkHostname(hostname: string) {
  return (
    hostname === 'localhost'
    || hostname.endsWith('.localhost')
    || hostname.endsWith('.local')
    || hostname.endsWith('.home.arpa')
    || (!hostname.includes('.') && !hostname.includes(':'))
  )
}

function isPrivateIPv6(hostname: string) {
  if (
    hasPrivateEmbeddedIPv4(hostname, '::ffff:')
    || hasPrivateEmbeddedIPv4(hostname, '::ffff:0:')
    || hasPrivateEmbeddedIPv4(hostname, '::')
  ) {
    return true
  }

  return (
    hostname === '::'
    || hostname === '::1'
    || hostname.startsWith('fe80:')
    || hostname.startsWith('fc')
    || hostname.startsWith('fd')
    || hostname.startsWith('ff')
  )
}

export function isLocalNetworkHttpUrl(value: string) {
  try {
    const url = new URL(value, getUrlBase())
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false
    const hostname = url.hostname.replace(/^\[|\]$/g, '').replace(/\.+$/g, '').toLowerCase()
    return isLocalNetworkHostname(hostname) || isPrivateIPv4(hostname) || isPrivateIPv6(hostname)
  } catch {
    return false
  }
}

export function isPublicRemoteMediaUrl(value: string) {
  const trimmed = value.trim()
  if (trimmed.length > maxRemoteMediaUrlChars) return false
  if (controlOrBidiPattern.test(trimmed)) return false
  if (hasUnsafeBackslashUrlSyntax(trimmed)) return false
  if (!trimmed.startsWith('//') && !/^https?:/i.test(trimmed)) return false
  const normalized = trimmed.startsWith('//') ? `https:${trimmed}` : trimmed
  try {
    const url = new URL(normalized, getUrlBase())
    return (
      (url.protocol === 'http:' || url.protocol === 'https:')
      && !isLocalNetworkHttpUrl(normalized)
    )
  } catch {
    return false
  }
}

export function getInternalImageAssetPath(value: unknown) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (trimmed.length > maxInternalImageSrcChars) return null
  const scheme = schemePattern.exec(trimmed)?.[1]?.toLowerCase()
  if (scheme !== 'img') return null

  const assetPath = trimmed.slice(trimmed.indexOf(':') + 1)
  if (
    !assetPath
    || controlOrBidiPattern.test(assetPath)
    || hasInternalImageUrlPathSegment(assetPath)
    || assetPath.startsWith('//')
    || assetPath.startsWith('\\')
    || windowsAbsolutePathPattern.test(assetPath)
    || unixAbsolutePathPattern.test(assetPath)
  ) return null

  return assetPath
}

export function sanitizeMediaSrc(value: unknown) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed || controlOrBidiPattern.test(trimmed) || hasUnsafeBackslashUrlSyntax(trimmed) || windowsAbsolutePathPattern.test(trimmed) || (unixAbsolutePathPattern.test(trimmed) && !trimmed.startsWith('//'))) return null
  if (trimmed.startsWith('//')) return trimmed.length > maxRemoteMediaUrlChars || isLocalNetworkHttpUrl(`https:${trimmed}`) ? null : `https:${trimmed}`

  const scheme = schemePattern.exec(trimmed)?.[1]?.toLowerCase()
  if (!scheme) return trimmed.length <= maxInternalImageSrcChars ? trimmed : null
  const normalizedScheme = `${scheme}:`
  if (normalizedScheme === 'img:') {
    return getInternalImageAssetPath(trimmed) ? trimmed : null
  }
  if (normalizedScheme === 'data:') {
    const commaIndex = trimmed.indexOf(',')
    if (commaIndex < 0 || trimmed.length - commaIndex - 1 > maxInlineImageBase64Chars) return null
    const match = safeDataImagePattern.exec(trimmed)
    if (!match) return null
    const byteLength = getBase64DecodedByteLength(match[2])
    return byteLength !== null && byteLength <= maxInlineImageBytes
      ? `${match[1].toLowerCase()}${match[2]}`
      : null
  }
  if (!safeMediaSchemes.has(normalizedScheme)) return null
  if ((normalizedScheme === 'http:' || normalizedScheme === 'https:' || normalizedScheme === 'blob:') && trimmed.length > maxRemoteMediaUrlChars) return null
  if ((normalizedScheme === 'http:' || normalizedScheme === 'https:') && isLocalNetworkHttpUrl(trimmed)) return null
  return trimmed
}
