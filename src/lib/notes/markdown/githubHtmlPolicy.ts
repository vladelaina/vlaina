import { hasUrlCredentials, isLocalNetworkHttpUrl } from './urlSecurity';
import { hasInternalNoteAssetUrlPathSegment } from '@/lib/assets/core/internalAssetPaths';
import {
  GITHUB_ALLOWED_ATTRIBUTES_BY_TAG,
  GITHUB_ALLOWED_GLOBAL_ATTRIBUTES,
  GITHUB_ALLOWED_IFRAME_ALLOW_FEATURES,
  GITHUB_ALLOWED_IFRAME_SANDBOX_TOKENS,
  GITHUB_ALLOWED_MEDIA_PROTOCOLS,
  GITHUB_ALLOWED_RELATIVE_PROTOCOL_MARKERS,
  GITHUB_ALLOWED_STYLE_PROPERTIES,
  GITHUB_FORCED_IFRAME_SANDBOX,
  GITHUB_SRCSET_ATTRIBUTES_BY_TAG,
  GITHUB_URL_ATTRIBUTES_BY_TAG,
} from './githubHtmlPolicyConstants';

export * from './githubHtmlPolicyConstants';

const GITHUB_SRCSET_DESCRIPTOR_PATTERN = /^\d+(?:\.\d+)?(?:w|x)$/;
const HTTP_AUTHORITY_URL_PATTERN = /^https?:\/\//i;
const BACKSLASH_ESCAPED_SCHEME_PATTERN = /^[A-Za-z][A-Za-z0-9+.-]*\\+:/;
export const MAX_GITHUB_HTML_ATTRIBUTE_VALUE_CHARS = 16 * 1024;
const MAX_GITHUB_SRCSET_CANDIDATES = 128;

export function isGithubHtmlAttributeValueAllowed(value: string): boolean {
  return value.length <= MAX_GITHUB_HTML_ATTRIBUTE_VALUE_CHARS;
}

export function isGithubAllowedAttribute(tagName: string, attributeName: string): boolean {
  const normalizedAttribute = attributeName.toLowerCase();
  if (normalizedAttribute.startsWith('on')) return false;
  if (normalizedAttribute === 'class' || normalizedAttribute === 'id') return false;
  if (normalizedAttribute.startsWith('data-')) return false;
  return (
    GITHUB_ALLOWED_GLOBAL_ATTRIBUTES.has(normalizedAttribute)
    || Boolean(GITHUB_ALLOWED_ATTRIBUTES_BY_TAG[tagName]?.has(normalizedAttribute))
  );
}

export function sanitizeGithubStyle(value: string): string | null {
  if (!isGithubHtmlAttributeValueAllowed(value)) return null;

  const declarations: string[] = [];

  for (const rawDeclaration of value.split(';')) {
    const separatorIndex = rawDeclaration.indexOf(':');
    if (separatorIndex <= 0) continue;

    const property = rawDeclaration.slice(0, separatorIndex).trim().toLowerCase();
    const propertyValue = rawDeclaration.slice(separatorIndex + 1).trim();
    if (!GITHUB_ALLOWED_STYLE_PROPERTIES.has(property)) continue;
    if (!propertyValue || /[\u0000-\u001F\u007F]/.test(propertyValue)) continue;
    if (/\\|\/\*|\*\//.test(propertyValue)) continue;
    if (/(?:\b(?:url|image-set|cross-fade|paint|expression)|-webkit-image-set)\s*\(|@import|javascript:/i.test(propertyValue)) continue;
    declarations.push(`${property}: ${propertyValue}`);
  }

  return declarations.length > 0 ? declarations.join('; ') : null;
}

export function sanitizeGithubIframeSandbox(value: string | null): string {
  const tokens = new Set(GITHUB_FORCED_IFRAME_SANDBOX.split(/\s+/).filter(Boolean));
  if (value && !isGithubHtmlAttributeValueAllowed(value)) {
    return Array.from(tokens).join(' ');
  }

  for (const token of (value ?? '').split(/\s+/)) {
    const normalized = token.trim().toLowerCase();
    if (GITHUB_ALLOWED_IFRAME_SANDBOX_TOKENS.has(normalized)) {
      tokens.add(normalized);
    }
  }
  return Array.from(tokens).join(' ');
}

export function sanitizeGithubIframeAllow(value: string | null): string | null {
  if (!value || !isGithubHtmlAttributeValueAllowed(value)) return null;
  if (/[\u0000-\u001F\u007F\u202A-\u202E\u2066-\u2069\uFFFD]/.test(value)) return null;

  const features: string[] = [];
  for (const rawEntry of value.split(';')) {
    const feature = rawEntry.trim().split(/\s+/, 1)[0]?.toLowerCase();
    if (feature && GITHUB_ALLOWED_IFRAME_ALLOW_FEATURES.has(feature) && !features.includes(feature)) {
      features.push(feature);
    }
  }
  return features.length > 0 ? features.join('; ') : null;
}

export function isGithubUrlAttribute(tagName: string, attributeName: string): boolean {
  return Boolean(GITHUB_URL_ATTRIBUTES_BY_TAG[tagName]?.has(attributeName.toLowerCase()));
}

export function isGithubSrcsetAttribute(tagName: string, attributeName: string): boolean {
  return Boolean(GITHUB_SRCSET_ATTRIBUTES_BY_TAG[tagName]?.has(attributeName.toLowerCase()));
}

export function isGithubTagSpecificUrlAttribute(tagName: string, attributeName: string): boolean {
  return isGithubUrlAttribute(tagName, attributeName) || isGithubSrcsetAttribute(tagName, attributeName);
}

function isGithubSrcsetWhitespace(char: string): boolean {
  return /\s/.test(char);
}

function getGithubSrcsetCandidateParts(candidate: string): readonly [string, string?] | null {
  let index = 0;
  while (index < candidate.length && isGithubSrcsetWhitespace(candidate[index])) {
    index += 1;
  }

  const sourceStart = index;
  while (index < candidate.length && !isGithubSrcsetWhitespace(candidate[index])) {
    index += 1;
  }
  if (sourceStart === index) {
    return null;
  }

  const source = candidate.slice(sourceStart, index);
  while (index < candidate.length && isGithubSrcsetWhitespace(candidate[index])) {
    index += 1;
  }
  if (index >= candidate.length) {
    return [source];
  }

  const descriptorStart = index;
  while (index < candidate.length && !isGithubSrcsetWhitespace(candidate[index])) {
    index += 1;
  }
  const descriptor = candidate.slice(descriptorStart, index);

  while (index < candidate.length && isGithubSrcsetWhitespace(candidate[index])) {
    index += 1;
  }
  if (index < candidate.length) {
    return null;
  }

  return [source, descriptor];
}

export function hasGithubProtocol(value: string): boolean {
  return value.includes('://');
}

export function hasGithubUrlScheme(value: string): boolean {
  const compacted = value.replace(/[\u0000-\u0020\u007F\u202A-\u202E\u2066-\u2069\uFFFD]/g, '');
  return /(?:^|["'(<])(?:javascript|data|vbscript|file|blob):/i.test(compacted);
}

function hasUnsafeGithubBackslashUrlSyntax(value: string): boolean {
  return value.includes('\\') && (
    value.startsWith('\\') ||
    value.startsWith('//') ||
    /^[A-Za-z][A-Za-z0-9+.-]*:/.test(value) ||
    BACKSLASH_ESCAPED_SCHEME_PATTERN.test(value)
  );
}

function isSafeGithubPlainRelativeMediaUrl(value: string): boolean {
  return (
    !hasGithubProtocol(value)
    && !hasInternalNoteAssetUrlPathSegment(value)
    && !/^[A-Za-z][A-Za-z0-9+.-]*:/.test(value)
    && !value.startsWith('//')
    && !value.startsWith('\\')
    && !/^[A-Za-z]:[\\/]/.test(value)
    && !value.startsWith('/')
    && !/[\u0000-\u001F\u007F\u202A-\u202E\u2066-\u2069\uFFFD]/.test(value)
  );
}

function getGithubProtocolMarker(value: string): string {
  let position = 0;
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (char !== ':' && char !== '/' && char !== '#' && position + 1 < value.length) {
      position = index + 1;
      continue;
    }
    break;
  }

  const marker = value[position];
  if (marker === '/' || marker === '#') return marker;
  return `${value.slice(0, position).toLowerCase()}:`;
}

export function normalizeGithubUrl(
  value: string,
  allowedProtocols: ReadonlySet<string>,
  options: { blockLocalNetwork?: boolean; allowPlainRelative?: boolean; allowProtocolRelative?: boolean } = {},
): string | null {
  if (!isGithubHtmlAttributeValueAllowed(value)) return null;

  const trimmed = value.trimStart();
  if (!trimmed || /[\u0000-\u001F\u007F\u202A-\u202E\u2066-\u2069\uFFFD]/.test(trimmed)) {
    return null;
  }
  if (hasUnsafeGithubBackslashUrlSyntax(trimmed)) {
    return null;
  }

  const marker = getGithubProtocolMarker(trimmed);
  if (GITHUB_ALLOWED_RELATIVE_PROTOCOL_MARKERS.has(marker)) {
    if (trimmed.startsWith('//') && options.allowProtocolRelative === false) {
      return null;
    }
    if (!trimmed.startsWith('//') && !options.allowPlainRelative) {
      return null;
    }
    if (!trimmed.startsWith('//') && hasInternalNoteAssetUrlPathSegment(trimmed)) {
      return null;
    }
    if (trimmed.startsWith('//')) {
      const normalized = `https:${trimmed}`;
      if (hasUrlCredentials(normalized)) return null;
      if (options.blockLocalNetwork && isLocalNetworkHttpUrl(normalized)) return null;
      return normalized;
    }
    if (
      marker === '/'
      && !trimmed.startsWith('//')
      && options.allowPlainRelative
      && options.blockLocalNetwork
      && !isSafeGithubPlainRelativeMediaUrl(trimmed)
    ) {
      return null;
    }
    return trimmed;
  }
  if (options.allowPlainRelative && isSafeGithubPlainRelativeMediaUrl(trimmed)) {
    return trimmed;
  }
  if (!allowedProtocols.has(marker)) return null;
  if ((marker === 'http:' || marker === 'https:') && !HTTP_AUTHORITY_URL_PATTERN.test(trimmed)) return null;
  if ((marker === 'http:' || marker === 'https:') && hasUrlCredentials(trimmed)) return null;
  if (options.blockLocalNetwork && isLocalNetworkHttpUrl(trimmed)) return null;
  return trimmed;
}

export function normalizeGithubSrcset(value: string): string | null {
  if (!isGithubHtmlAttributeValueAllowed(value)) return null;

  const trimmed = value.trimStart();
  if (!trimmed || /[\u0000-\u001F\u007F\u202A-\u202E\u2066-\u2069\uFFFD]/.test(trimmed)) return null;

  const candidates: string[] = [];
  let candidateStart = 0;
  let candidateCount = 0;
  for (let index = 0; index <= trimmed.length; index += 1) {
    if (index < trimmed.length && trimmed[index] !== ',') {
      continue;
    }

    const rawCandidate = trimmed.slice(candidateStart, index);
    const candidate = rawCandidate.trim();
    candidateStart = index + 1;
    if (!candidate) {
      continue;
    }

    candidateCount += 1;
    if (candidateCount > MAX_GITHUB_SRCSET_CANDIDATES) {
      return null;
    }

    const parts = getGithubSrcsetCandidateParts(candidate);
    if (!parts) {
      return null;
    }
    const normalizedSource = normalizeGithubUrl(parts[0], GITHUB_ALLOWED_MEDIA_PROTOCOLS, {
      allowPlainRelative: true,
      allowProtocolRelative: true,
      blockLocalNetwork: true,
    });
    if (!normalizedSource) return null;
    if (
      parts[1]
      && !GITHUB_SRCSET_DESCRIPTOR_PATTERN.test(parts[1])
    ) {
      return null;
    }
    const trailingWhitespace = rawCandidate.match(/\s*$/)?.[0] ?? '';
    candidates.push(
      parts[1]
        ? `${normalizedSource} ${parts[1]}${trailingWhitespace}`
        : `${normalizedSource}${trailingWhitespace}`
    );
  }

  return candidateCount > 0 ? candidates.join(', ') : null;
}
