import { defaultSchema } from 'rehype-sanitize';

const IMAGE_PROTOCOL_WHITELIST = new Set([
  'http:',
  'https:',
  'data:',
  'blob:',
  'asset:',
]);

const RELATIVE_PREFIXES = ['/', './', '../'];
const SAFE_DATA_IMAGE_PATTERN = /^data:image\/(?:png|jpeg|jpg|webp|gif|bmp|avif);base64,[A-Za-z0-9+/=]+$/i;
const SAFE_COLOR_STYLE_PATTERN = /^(?:color|background-color):\s*(?:#[0-9a-f]{3,8}|(?:rgb|rgba|hsl|hsla)\(\s*[-+.\d%]+\s*(?:,\s*[-+.\d%]+\s*){2,3}\)|var\(--[A-Za-z0-9_-]+\)|[A-Za-z]+)$/i;
const SAFE_TEXT_ALIGN_STYLE_PATTERN = /^text-align:\s*(?:center|right)$/i;
const SAFE_TOC_INDENT_STYLE_PATTERN = /^padding-left:\s*(?:0|16|32|48|64|80)px$/i;

function isRelativePath(value: string): boolean {
  return RELATIVE_PREFIXES.some((prefix) => value.startsWith(prefix));
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
  if (!trimmed) {
    return null;
  }

  if (/\s/.test(trimmed)) {
    return null;
  }

  if (isRelativePath(trimmed)) {
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
    if (!IMAGE_PROTOCOL_WHITELIST.has(parsed.protocol)) {
      return null;
    }
    return trimmed;
  } catch {
    return null;
  }
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
      src: Array.from(new Set([...srcProtocols, 'http', 'https', 'data', 'blob', 'asset'])),
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
      div: Array.from(new Set([...(attributes.div || []), 'className', 'data*'])),
    },
  };
}
