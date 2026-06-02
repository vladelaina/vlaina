const controlOrBidiPattern = /[\u0000-\u001F\u007F\u202A-\u202E\u2066-\u2069\uFFFD]/
const schemePattern = /^([A-Za-z][A-Za-z0-9+.-]*):/
const windowsAbsolutePathPattern = /^[A-Za-z]:[\\/]/
const unixAbsolutePathPattern = /^\//
const safeMediaSchemes = new Set(['http:', 'https:', 'blob:'])
const fallbackUrlBase = 'https://milkdown.local/'

function getUrlBase() {
  return typeof window !== 'undefined' ? window.location.href : fallbackUrlBase
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
  if (hostname.startsWith('::ffff:')) {
    const parts = hostname.slice('::ffff:'.length).split(':')
    if (parts.length === 2) {
      const high = Number.parseInt(parts[0], 16)
      const low = Number.parseInt(parts[1], 16)
      if (
        Number.isFinite(high)
        && Number.isFinite(low)
        && high >= 0
        && high <= 0xffff
        && low >= 0
        && low <= 0xffff
      ) {
        const mapped = [
          (high >> 8) & 255,
          high & 255,
          (low >> 8) & 255,
          low & 255,
        ].join('.')
        return isPrivateIPv4(mapped)
      }
    }
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
  if (controlOrBidiPattern.test(trimmed)) return false
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

export function sanitizeMediaSrc(value: unknown) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed || controlOrBidiPattern.test(trimmed) || windowsAbsolutePathPattern.test(trimmed) || (unixAbsolutePathPattern.test(trimmed) && !trimmed.startsWith('//'))) return null
  if (trimmed.startsWith('//')) return isLocalNetworkHttpUrl(`https:${trimmed}`) ? null : trimmed

  const scheme = schemePattern.exec(trimmed)?.[1]?.toLowerCase()
  if (!scheme) return trimmed
  const normalizedScheme = `${scheme}:`
  if (!safeMediaSchemes.has(normalizedScheme)) return null
  if ((normalizedScheme === 'http:' || normalizedScheme === 'https:') && isLocalNetworkHttpUrl(trimmed)) return null
  return trimmed
}
