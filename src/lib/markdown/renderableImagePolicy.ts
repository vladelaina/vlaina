import { extractStoredAttachmentFilename, isAppFileAttachmentUrl } from '@/lib/storage/attachmentUrl';
import { isLocalNetworkHttpUrl } from '@/lib/notes/markdown/urlSecurity';
import { hasInternalNoteAssetUrlPathSegment } from '@/lib/assets/core/internalAssetPaths';
import { MAX_INLINE_IMAGE_BASE64_CHARS, normalizeSafeRasterDataImageSrc } from './dataImagePolicy';

const IMAGE_PROTOCOL_WHITELIST = new Set([
  'http:',
  'https:',
  'data:',
  'blob:',
  'attachment:',
  'app-file:',
]);

const CONTROL_OR_BIDI_PATTERN = /[\u0000-\u001F\u007F\u202A-\u202E\u2066-\u2069\uFFFD]/;
const RELATIVE_PREFIXES = ['./', '../'];
const SCHEME_PATTERN = /^[A-Za-z][A-Za-z0-9+.-]*:/;
const BACKSLASH_ESCAPED_SCHEME_PATTERN = /^[A-Za-z][A-Za-z0-9+.-]*\\+:/;
const IMAGE_EXTENSION_PATTERN = /\.(?:png|jpe?g|webp|gif|bmp|avif)(?:[?#].*)?$/i;
const MAX_RENDERABLE_IMAGE_SRC_CHARS = 4096;
const MAX_RENDERABLE_IMAGE_SRCSET_CHARS = 64 * 1024;
const MAX_RENDERABLE_DATA_IMAGE_SRCSET_CHARS = MAX_INLINE_IMAGE_BASE64_CHARS + 4096;
const MAX_RENDERABLE_IMAGE_SRCSET_CANDIDATES = 128;
const HTTP_AUTHORITY_URL_PATTERN = /^https?:\/\//i;

function isRelativePath(value: string): boolean {
  if (value.startsWith('//')) {
    return false;
  }
  if (hasInternalNoteAssetUrlPathSegment(value)) {
    return false;
  }
  return RELATIVE_PREFIXES.some((prefix) => value.startsWith(prefix));
}

function isBareRelativeImagePath(value: string): boolean {
  if (value.startsWith('/') || SCHEME_PATTERN.test(value)) {
    return false;
  }
  if (hasInternalNoteAssetUrlPathSegment(value)) {
    return false;
  }
  return value.includes('/') || IMAGE_EXTENSION_PATTERN.test(value);
}

function hasUnsafeBackslashUrlSyntax(value: string): boolean {
  return value.includes('\\') && (
    value.startsWith('\\') ||
    value.startsWith('//') ||
    SCHEME_PATTERN.test(value) ||
    BACKSLASH_ESCAPED_SCHEME_PATTERN.test(value)
  );
}

function startsWithDataImageCandidate(value: string): boolean {
  let index = 0;
  while (index < value.length && index < 128 && /\s/.test(value[index])) {
    index += 1;
  }
  return /^data:/i.test(value.slice(index, index + 5));
}

function isAllowedAssetUrl(url: URL): boolean {
  if (url.protocol !== 'asset:') {
    return false;
  }

  const hostname = url.hostname.trim().toLowerCase();
  if (hostname !== 'localhost') {
    return false;
  }

  return /^\/chat-inline-image\/\d+$/.test(url.pathname);
}

export function isRenderableDataImageSrc(src: string | null | undefined): boolean {
  return normalizeRenderableDataImageSrc(src) !== null;
}

export function normalizeRenderableDataImageSrc(src: string | null | undefined): string | null {
  return normalizeSafeRasterDataImageSrc(src);
}

export function normalizeRenderableImageSrc(src: string | null | undefined): string | null {
  if (!src) {
    return null;
  }

  const trimmed = src.trim();
  if (!trimmed || CONTROL_OR_BIDI_PATTERN.test(trimmed)) {
    return null;
  }
  if (hasUnsafeBackslashUrlSyntax(trimmed)) {
    return null;
  }

  if (/^data:/i.test(trimmed)) {
    return normalizeRenderableDataImageSrc(trimmed);
  }

  if (trimmed.length > MAX_RENDERABLE_IMAGE_SRC_CHARS) {
    return null;
  }

  if (!isBareRelativeImagePath(trimmed) && /\s/.test(trimmed)) {
    return null;
  }

  if (trimmed.startsWith('//')) {
    const normalized = `https:${trimmed}`;
    try {
      const parsed = new URL(normalized);
      if (parsed.username || parsed.password) {
        return null;
      }
    } catch {
      return null;
    }
    return isLocalNetworkHttpUrl(normalized) ? null : normalized;
  }

  if (/^https?:/i.test(trimmed) && !HTTP_AUTHORITY_URL_PATTERN.test(trimmed)) {
    return null;
  }

  if (isRelativePath(trimmed) || isBareRelativeImagePath(trimmed)) {
    return trimmed;
  }

  try {
    const base = typeof window !== 'undefined' ? window.location.href : 'http://localhost';
    const parsed = new URL(trimmed, base);
    if (parsed.protocol === 'asset:') {
      return isAllowedAssetUrl(parsed) ? trimmed : null;
    }
    if (parsed.protocol === 'attachment:') {
      return extractStoredAttachmentFilename(trimmed) ? trimmed : null;
    }
    if (parsed.protocol === 'app-file:') {
      return isAppFileAttachmentUrl(parsed) && extractStoredAttachmentFilename(trimmed) ? trimmed : null;
    }
    if (!IMAGE_PROTOCOL_WHITELIST.has(parsed.protocol)) {
      return null;
    }
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      if (parsed.username || parsed.password) {
        return null;
      }
      if (isLocalNetworkHttpUrl(trimmed)) {
        return null;
      }
    }
    return trimmed;
  } catch {
    return null;
  }
}

function isSrcsetWhitespace(char: string): boolean {
  return /\s/.test(char);
}

function getSrcsetCandidateParts(candidate: string): readonly [string, string?] | null {
  let index = 0;
  while (index < candidate.length && isSrcsetWhitespace(candidate[index])) {
    index += 1;
  }

  const sourceStart = index;
  while (index < candidate.length && !isSrcsetWhitespace(candidate[index])) {
    index += 1;
  }
  if (sourceStart === index) {
    return null;
  }

  const source = candidate.slice(sourceStart, index);
  while (index < candidate.length && isSrcsetWhitespace(candidate[index])) {
    index += 1;
  }
  if (index >= candidate.length) {
    return [source];
  }

  const descriptorStart = index;
  while (index < candidate.length && !isSrcsetWhitespace(candidate[index])) {
    index += 1;
  }
  const descriptor = candidate.slice(descriptorStart, index);

  while (index < candidate.length && isSrcsetWhitespace(candidate[index])) {
    index += 1;
  }
  if (index < candidate.length) {
    return null;
  }

  return [source, descriptor];
}

function normalizeSrcsetCandidate(candidate: string): string | null {
  const parts = getSrcsetCandidateParts(candidate);
  if (!parts) {
    return null;
  }

  const source = normalizeRenderableImageSrc(parts[0]);
  if (!source) {
    return null;
  }

  const descriptor = parts[1];
  if (descriptor && !/^\d+(?:\.\d+)?(?:w|x)$/.test(descriptor)) {
    return null;
  }

  return descriptor ? `${source} ${descriptor}` : source;
}

function splitRenderableImageSrcsetCandidates(value: string): string[] | null {
  const candidates: string[] = [];
  let candidateStart = 0;
  let skippedDataUrlComma = false;

  for (let index = 0; index < value.length; index += 1) {
    if (value[index] !== ',') {
      continue;
    }

    const candidatePrefix = value.slice(candidateStart, index).trimStart();
    if (!skippedDataUrlComma && /^data:/i.test(candidatePrefix)) {
      skippedDataUrlComma = true;
      continue;
    }

    const candidate = value.slice(candidateStart, index).trim();
    if (candidate) {
      candidates.push(candidate);
      if (candidates.length > MAX_RENDERABLE_IMAGE_SRCSET_CANDIDATES) {
        return null;
      }
    }
    candidateStart = index + 1;
    skippedDataUrlComma = false;
  }

  const tail = value.slice(candidateStart).trim();
  if (tail) {
    candidates.push(tail);
    if (candidates.length > MAX_RENDERABLE_IMAGE_SRCSET_CANDIDATES) {
      return null;
    }
  }
  return candidates;
}

export function normalizeRenderableImageSrcset(value: string | null | undefined): string | null {
  if (!value || CONTROL_OR_BIDI_PATTERN.test(value)) {
    return null;
  }
  if (value.length > MAX_RENDERABLE_IMAGE_SRCSET_CHARS) {
    if (!startsWithDataImageCandidate(value) || value.length > MAX_RENDERABLE_DATA_IMAGE_SRCSET_CHARS) {
      return null;
    }
  }

  const candidates = splitRenderableImageSrcsetCandidates(value);
  if (!candidates || candidates.length === 0) {
    return null;
  }

  const normalizedCandidates: string[] = [];
  for (const candidate of candidates) {
    const normalized = normalizeSrcsetCandidate(candidate);
    if (!normalized) {
      return null;
    }
    normalizedCandidates.push(normalized);
  }

  return normalizedCandidates.join(', ');
}
