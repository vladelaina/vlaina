import { defaultSchema } from 'rehype-sanitize';
import { extractStoredAttachmentFilename, isAppFileAttachmentUrl } from '@/lib/storage/attachmentUrl';
import { isLocalNetworkHttpUrl } from '@/lib/notes/markdown/urlSecurity';

const IMAGE_PROTOCOL_WHITELIST = new Set([
  'http:',
  'https:',
  'data:',
  'blob:',
  'asset:',
  'attachment:',
  'app-file:',
]);

const CONTROL_OR_BIDI_PATTERN = /[\u0000-\u001F\u007F\u202A-\u202E\u2066-\u2069\uFFFD]/;
const RELATIVE_PREFIXES = ['./', '../'];
const SCHEME_PATTERN = /^[A-Za-z][A-Za-z0-9+.-]*:/;
const IMAGE_EXTENSION_PATTERN = /\.(?:png|jpe?g|webp|gif|bmp|avif)(?:[?#].*)?$/i;
const SAFE_DATA_IMAGE_PATTERN = /^data:image\/(?:png|jpeg|jpg|webp|gif|bmp|avif);base64,[A-Za-z0-9+/=]+$/i;
const SAFE_COLOR_STYLE_PATTERN = /^(?:color|background-color)\s*:\s*(?:#[0-9a-f]{3,8}|(?:rgb|rgba|hsl|hsla)\(\s*[-+.\d%]+\s*(?:,\s*[-+.\d%]+\s*){2,3}\)|var\(--[A-Za-z0-9_-]+\)|[A-Za-z]+)$/i;
const SAFE_TEXT_ALIGN_STYLE_PATTERN = /^text-align\s*:\s*(?:center|right)$/i;
const SAFE_TOC_INDENT_STYLE_PATTERN = /^padding-left\s*:\s*(?:0|16|32|48|64|80)px$/i;

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

function isAllowedAssetUrl(url: URL): boolean {
  if (url.protocol !== 'asset:') {
    return false;
  }

  const hostname = url.hostname.trim().toLowerCase();
  if (hostname !== 'localhost' && hostname !== 'asset.localhost') {
    return false;
  }

  return url.pathname.trim().length > 1;
}

export function normalizeRenderableImageSrc(src: string | null | undefined): string | null {
  if (!src) {
    return null;
  }

  const trimmed = src.trim();
  if (!trimmed || CONTROL_OR_BIDI_PATTERN.test(trimmed)) {
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
      return SAFE_DATA_IMAGE_PATTERN.test(trimmed) ? trimmed : null;
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

export function normalizeRenderableImageSrcset(value: string | null | undefined): string | null {
  if (!value || CONTROL_OR_BIDI_PATTERN.test(value)) {
    return null;
  }

  const candidates = value.split(',').map((candidate) => candidate.trim()).filter(Boolean);
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

function sanitizeImageSrcsetProperties(node: any): void {
  if (!node || typeof node !== 'object') {
    return;
  }

  if (node.type === 'element' && node.properties && typeof node.properties === 'object') {
    for (const key of ['srcSet', 'srcset']) {
      if (!Object.prototype.hasOwnProperty.call(node.properties, key)) {
        continue;
      }
      const normalized = normalizeRenderableImageSrcset(String(node.properties[key] || ''));
      if (normalized) {
        node.properties[key] = normalized;
      } else {
        delete node.properties[key];
      }
    }
  }

  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      sanitizeImageSrcsetProperties(child);
    }
  }
}

export function rehypeImageSrcsetSanitizer() {
  return (tree: any) => {
    sanitizeImageSrcsetProperties(tree);
  };
}

export function createMarkdownSanitizeSchema() {
  const protocols = (defaultSchema.protocols || {}) as Record<string, string[]>;
  const hrefProtocols = protocols.href || [];
  const srcProtocols = protocols.src || [];
  const tagNames = Array.isArray(defaultSchema.tagNames) ? defaultSchema.tagNames : [];
  const attributes = (defaultSchema.attributes || {}) as Record<string, Array<string | [string, ...unknown[]]>>;

  const colorStyleAttribute: [string, RegExp] = ['style', SAFE_COLOR_STYLE_PATTERN];
  const textAlignStyleAttribute: [string, RegExp] = ['style', SAFE_TEXT_ALIGN_STYLE_PATTERN];
  const tocIndentStyleAttribute: [string, RegExp] = ['style', SAFE_TOC_INDENT_STYLE_PATTERN];
  const generatedDivTypeAttribute: [string, 'toc', 'callout'] = ['dataType', 'toc', 'callout'];
  const alignedBlockAttributes = ['dataTextAlign', textAlignStyleAttribute] as const;

  return {
    ...defaultSchema,
    tagNames: Array.from(new Set([...tagNames, 'abbr', 'mark', 'sup', 'sub', 'u'])),
    required: {
      ...(defaultSchema.required || {}),
    },
    protocols: {
      ...protocols,
      href: Array.from(new Set([...hrefProtocols, 'tel'])),
      src: Array.from(new Set([...srcProtocols, 'http', 'https', 'data', 'blob', 'asset', 'attachment', 'app-file'])),
    },
    // Keep generated Notes color marks without admitting arbitrary raw style payloads.
    attributes: {
      ...attributes,
      mark: Array.from(new Set([...(attributes.mark || []), 'className', 'dataBgColor'])).concat([
        colorStyleAttribute,
      ]),
      sup: Array.from(new Set([...(attributes.sup || []), 'className'])),
      sub: Array.from(new Set([...(attributes.sub || []), 'className'])),
      u: Array.from(new Set([...(attributes.u || []), 'className'])),
      abbr: Array.from(new Set([...(attributes.abbr || []), 'className', 'title'])),
      a: Array.from(new Set([...(attributes.a || []), 'className'])),
      span: Array.from(new Set([...(attributes.span || []), 'className', 'dataTextColor'])).concat([
        colorStyleAttribute,
      ]),
      ul: Array.from(new Set([...(attributes.ul || []), 'className'])),
      li: Array.from(new Set([...(attributes.li || []), 'className'])).concat([tocIndentStyleAttribute]),
      dl: Array.from(new Set([...(attributes.dl || []), 'className'])),
      dt: Array.from(new Set([...(attributes.dt || []), 'className'])),
      dd: Array.from(new Set([...(attributes.dd || []), 'className'])),
      img: Array.from(new Set([
        ...(attributes.img || []),
        'align',
        'width',
        'dataVlainaCrop',
      ])),
      p: Array.from(new Set([...(attributes.p || []), 'dataTextAlign'])).concat([textAlignStyleAttribute]),
      h1: Array.from(new Set([...(attributes.h1 || []), ...alignedBlockAttributes, 'id'])),
      h2: Array.from(new Set([...(attributes.h2 || []), ...alignedBlockAttributes, 'id'])),
      h3: Array.from(new Set([...(attributes.h3 || []), ...alignedBlockAttributes, 'id'])),
      h4: Array.from(new Set([...(attributes.h4 || []), ...alignedBlockAttributes, 'id'])),
      h5: Array.from(new Set([...(attributes.h5 || []), ...alignedBlockAttributes, 'id'])),
      h6: Array.from(new Set([...(attributes.h6 || []), ...alignedBlockAttributes, 'id'])),
      div: Array.from(new Set([...(attributes.div || []), 'className'])).concat([
        generatedDivTypeAttribute,
      ]),
    },
  };
}
