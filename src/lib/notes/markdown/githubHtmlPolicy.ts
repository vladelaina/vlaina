import { isLocalNetworkHttpUrl, sanitizeNoteMediaSrc } from './urlSecurity';

export const GITHUB_ALLOWED_HTML_TAGS = new Set([
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'br', 'b', 'i', 'strong', 'em', 'a', 'pre', 'code', 'img', 'tt',
  'div', 'ins', 'del', 'sup', 'sub', 'p', 'picture',
  'ol', 'ul', 'table', 'thead', 'tbody', 'tfoot', 'blockquote',
  'dl', 'dt', 'dd', 'kbd', 'q', 'samp', 'var', 'hr', 'ruby', 'rt', 'rp',
  'li', 'tr', 'td', 'th', 's', 'strike', 'summary', 'details', 'caption',
  'figure', 'figcaption', 'abbr', 'bdo', 'cite', 'dfn', 'mark', 'small',
  'source', 'span', 'time', 'wbr', 'video', 'audio', 'iframe', 'track',
]);

export const GITHUB_DROP_WITH_CONTENT_TAGS = new Set([
  'script', 'style', 'title', 'textarea', 'xmp', 'noembed',
  'noframes', 'plaintext', 'math', 'noscript', 'svg',
]);

export const GITHUB_WRAP_CONTENT_WITH_WHITESPACE_TAGS = new Set([
  'address', 'article', 'aside', 'blockquote', 'br', 'dd', 'div', 'dl', 'dt',
  'footer', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'header', 'hgroup', 'hr',
  'li', 'nav', 'ol', 'p', 'pre', 'section', 'ul',
]);

export const GITHUB_ALLOWED_GLOBAL_ATTRIBUTES = new Set([
  'abbr', 'accept', 'accept-charset', 'accesskey', 'action', 'align', 'alt',
  'aria-describedby', 'aria-hidden', 'aria-label', 'aria-labelledby', 'axis',
  'border', 'char', 'charoff', 'charset', 'checked', 'clear', 'cols', 'colspan',
  'compact', 'coords', 'datetime', 'dir', 'disabled', 'enctype', 'for', 'frame',
  'headers', 'height', 'hreflang', 'hspace', 'ismap', 'label', 'lang',
  'maxlength', 'media', 'method', 'multiple', 'name', 'nohref', 'noshade',
  'nowrap', 'open', 'progress', 'prompt', 'readonly', 'rel', 'rev', 'role',
  'rows', 'rowspan', 'rules', 'scope', 'selected', 'shape', 'size', 'span',
  'start', 'style', 'summary', 'tabindex', 'title', 'type', 'usemap', 'valign', 'value',
  'width', 'itemprop',
]);

export const GITHUB_ALLOWED_ATTRIBUTES_BY_TAG: Readonly<Record<string, ReadonlySet<string>>> = {
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
};

export const GITHUB_URL_ATTRIBUTES_BY_TAG: Readonly<Record<string, ReadonlySet<string>>> = {
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
};

export const GITHUB_SRCSET_ATTRIBUTES_BY_TAG: Readonly<Record<string, ReadonlySet<string>>> = {
  source: new Set(['srcset']),
};

export const GITHUB_ALLOWED_RELATIVE_PROTOCOL_MARKERS = new Set(['#', '/']);
export const GITHUB_ALLOWED_LINK_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);
export const GITHUB_ALLOWED_MEDIA_PROTOCOLS = new Set(['http:', 'https:']);
export const GITHUB_FORCED_IFRAME_SANDBOX = 'allow-scripts';
export const GITHUB_ALLOWED_IFRAME_SANDBOX_TOKENS = new Set(['allow-scripts', 'allow-forms', 'allow-popups', 'allow-presentation']);
export const GITHUB_ALLOWED_STYLE_PROPERTIES = new Set([
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
]);

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
  const declarations: string[] = [];

  for (const rawDeclaration of value.split(';')) {
    const separatorIndex = rawDeclaration.indexOf(':');
    if (separatorIndex <= 0) continue;

    const property = rawDeclaration.slice(0, separatorIndex).trim().toLowerCase();
    const propertyValue = rawDeclaration.slice(separatorIndex + 1).trim();
    if (!GITHUB_ALLOWED_STYLE_PROPERTIES.has(property)) continue;
    if (!propertyValue || /[\u0000-\u001F\u007F]/.test(propertyValue)) continue;
    if (/url\s*\(|expression\s*\(|@import|javascript:/i.test(propertyValue)) continue;
    declarations.push(`${property}: ${propertyValue}`);
  }

  return declarations.length > 0 ? declarations.join('; ') : null;
}

export function sanitizeGithubIframeSandbox(value: string | null): string {
  const tokens = new Set(GITHUB_FORCED_IFRAME_SANDBOX.split(/\s+/).filter(Boolean));
  for (const token of (value ?? '').split(/\s+/)) {
    const normalized = token.trim().toLowerCase();
    if (GITHUB_ALLOWED_IFRAME_SANDBOX_TOKENS.has(normalized)) {
      tokens.add(normalized);
    }
  }
  return Array.from(tokens).join(' ');
}

export function isGithubUrlAttribute(tagName: string, attributeName: string): boolean {
  return Boolean(GITHUB_URL_ATTRIBUTES_BY_TAG[tagName]?.has(attributeName.toLowerCase()));
}

export function isGithubSrcsetAttribute(tagName: string, attributeName: string): boolean {
  return Boolean(GITHUB_SRCSET_ATTRIBUTES_BY_TAG[tagName]?.has(attributeName.toLowerCase()));
}

export function hasGithubProtocol(value: string): boolean {
  return value.includes('://');
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
  options: { blockLocalNetwork?: boolean; allowPlainRelative?: boolean } = {},
): string | null {
  const trimmed = value.trimStart();
  if (!trimmed || /[\u0000-\u001F\u007F\u202A-\u202E\u2066-\u2069\uFFFD]/.test(trimmed)) {
    return null;
  }

  const marker = getGithubProtocolMarker(trimmed);
  if (GITHUB_ALLOWED_RELATIVE_PROTOCOL_MARKERS.has(marker)) {
    if (options.blockLocalNetwork && trimmed.startsWith('//') && isLocalNetworkHttpUrl(`https:${trimmed}`)) {
      return null;
    }
    return trimmed;
  }
  if (options.allowPlainRelative && sanitizeNoteMediaSrc(trimmed) === trimmed) {
    return trimmed;
  }
  if (!allowedProtocols.has(marker)) return null;
  if (options.blockLocalNetwork && isLocalNetworkHttpUrl(trimmed)) return null;
  return trimmed;
}

export function normalizeGithubSrcset(value: string): string | null {
  const trimmed = value.trimStart();
  if (!trimmed || /[\u0000-\u001F\u007F\u202A-\u202E\u2066-\u2069\uFFFD]/.test(trimmed)) return null;
  const candidates = trimmed.split(',').map((candidate) => candidate.trim()).filter(Boolean);
  if (candidates.length === 0) return null;
  for (const candidate of candidates) {
    const source = candidate.split(/\s+/, 1)[0];
    if (!source || hasGithubProtocol(source) || source.startsWith('//') || sanitizeNoteMediaSrc(source) !== source) {
      return null;
    }
  }
  return trimmed;
}
