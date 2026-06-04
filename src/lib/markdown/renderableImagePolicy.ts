import { extractStoredAttachmentFilename, isAppFileAttachmentUrl } from '@/lib/storage/attachmentUrl';
import { isLocalNetworkHttpUrl } from '@/lib/notes/markdown/urlSecurity';
import { normalizeSafeRasterDataImageSrc } from './dataImagePolicy';

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
const IMAGE_EXTENSION_PATTERN = /\.(?:png|jpe?g|webp|gif|bmp|avif)(?:[?#].*)?$/i;

function isRelativePath(value: string): boolean {
  if (value.startsWith('//')) {
    return false;
  }
  return RELATIVE_PREFIXES.some((prefix) => value.startsWith(prefix));
}

function isBareRelativeImagePath(value: string): boolean {
  if (value.startsWith('/') || SCHEME_PATTERN.test(value)) {
    return false;
  }
  return value.includes('/') || IMAGE_EXTENSION_PATTERN.test(value);
}

function hasUnsafeBackslashUrlSyntax(value: string): boolean {
  return value.startsWith('\\') || (SCHEME_PATTERN.test(value) && value.includes('\\'));
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

  if (!isBareRelativeImagePath(trimmed) && /\s/.test(trimmed)) {
    return null;
  }

  if (isRelativePath(trimmed) || isBareRelativeImagePath(trimmed)) {
    return trimmed;
  }

  try {
    const base = typeof window !== 'undefined' ? window.location.href : 'http://localhost';
    const parsed = new URL(trimmed, base);
    if (parsed.protocol === 'data:') {
      return normalizeRenderableDataImageSrc(trimmed);
    }
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
    if ((parsed.protocol === 'http:' || parsed.protocol === 'https:') && isLocalNetworkHttpUrl(trimmed)) {
      return null;
    }
    return trimmed;
  } catch {
    return null;
  }
}

function normalizeSrcsetCandidate(candidate: string): string | null {
  const parts = candidate.trim().split(/\s+/).filter(Boolean);
  const source = normalizeRenderableImageSrc(parts[0]);
  if (!source || parts.length > 2) {
    return null;
  }

  const descriptor = parts[1];
  if (descriptor && !/^\d+(?:\.\d+)?(?:w|x)$/.test(descriptor)) {
    return null;
  }

  return descriptor ? `${source} ${descriptor}` : source;
}

function splitRenderableImageSrcsetCandidates(value: string): string[] {
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
    }
    candidateStart = index + 1;
    skippedDataUrlComma = false;
  }

  const tail = value.slice(candidateStart).trim();
  if (tail) {
    candidates.push(tail);
  }
  return candidates;
}

export function normalizeRenderableImageSrcset(value: string | null | undefined): string | null {
  if (!value || CONTROL_OR_BIDI_PATTERN.test(value)) {
    return null;
  }

  const candidates = splitRenderableImageSrcsetCandidates(value);
  if (candidates.length === 0) {
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
