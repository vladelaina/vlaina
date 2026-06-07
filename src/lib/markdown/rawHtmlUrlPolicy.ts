import {
  GITHUB_ALLOWED_ATTRIBUTES_BY_TAG,
  GITHUB_ALLOWED_HTML_TAGS,
  normalizeGithubUrl,
  sanitizeGithubIframeSandbox,
} from '@/lib/notes/markdown/githubHtmlPolicy';
import { sanitizeNoteLinkHref } from '@/lib/notes/markdown/urlSecurity';

const SAFE_RAW_HTML_MEDIA_SRC_SCHEMES = new Set(['http:', 'https:']);
const SAFE_RAW_HTML_LINK_SRC_SCHEMES = new Set(['http:', 'https:', 'mailto:']);

const RAW_HTML_URL_ATTRIBUTES_BY_TAG: Record<string, readonly string[]> = {
  a: ['href'],
  audio: ['src'],
  blockquote: ['cite'],
  del: ['cite'],
  iframe: ['src'],
  img: ['longDesc'],
  ins: ['cite'],
  q: ['cite'],
  source: ['src'],
  track: ['src'],
  video: ['poster', 'src'],
};

export const GITHUB_RAW_HTML_TAGS = Array.from(GITHUB_ALLOWED_HTML_TAGS);

const HAST_ATTRIBUTE_NAME_BY_HTML_ATTRIBUTE: Record<string, string> = {
  'accept-charset': 'acceptCharset',
  allowfullscreen: 'allowFullScreen',
  allowtransparency: 'allowTransparency',
  charoff: 'charOff',
  charset: 'charSet',
  colspan: 'colSpan',
  datetime: 'dateTime',
  enctype: 'encType',
  for: 'htmlFor',
  frameborder: 'frameBorder',
  hreflang: 'hrefLang',
  hspace: 'hSpace',
  ismap: 'isMap',
  itemprop: 'itemProp',
  itemscope: 'itemScope',
  itemtype: 'itemType',
  longdesc: 'longDesc',
  maxlength: 'maxLength',
  nohref: 'noHref',
  noshade: 'noShade',
  nowrap: 'noWrap',
  playsinline: 'playsInline',
  readonly: 'readOnly',
  referrerpolicy: 'referrerPolicy',
  rowspan: 'rowSpan',
  srclang: 'srcLang',
  srcset: 'srcSet',
  tabindex: 'tabIndex',
  usemap: 'useMap',
  valign: 'vAlign',
};

export const GITHUB_RAW_HTML_ATTRIBUTE_NAMES_BY_TAG: Record<string, readonly string[]> = Object.fromEntries(
  Object.entries(GITHUB_ALLOWED_ATTRIBUTES_BY_TAG).map(([tagName, attributes]) => [
    tagName,
    Array.from(attributes).map((attribute) =>
      HAST_ATTRIBUTE_NAME_BY_HTML_ATTRIBUTE[attribute] ?? attribute.replace(/-([a-z])/g, (_, char: string) => char.toUpperCase())
    ),
  ]),
);

function normalizeRawHtmlLinkUrl(value: unknown): string | null {
  const safeHref = sanitizeNoteLinkHref(value);
  if (!safeHref || safeHref.startsWith('//')) return null;
  return safeHref;
}

function normalizeRawHtmlMediaUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  return normalizeGithubUrl(value, SAFE_RAW_HTML_MEDIA_SRC_SCHEMES, {
    allowPlainRelative: true,
    allowProtocolRelative: true,
    blockLocalNetwork: true,
  });
}

function normalizeRawHtmlUrlAttribute(tagName: string, attributeName: string, value: unknown): string | null {
  if (tagName === 'a' && attributeName === 'href') return normalizeRawHtmlLinkUrl(value);
  if (attributeName === 'cite') {
    return typeof value === 'string'
      ? normalizeGithubUrl(value, SAFE_RAW_HTML_LINK_SRC_SCHEMES, { allowPlainRelative: true, blockLocalNetwork: true })
      : null;
  }
  return normalizeRawHtmlMediaUrl(value);
}

export function sanitizeRawHtmlUrlProperties(node: any): void {
  if (!node || typeof node !== 'object') {
    return;
  }

  if (node.type !== 'element' || !node.properties || typeof node.properties !== 'object') {
    return;
  }

  const tagName = typeof node.tagName === 'string' ? node.tagName.toLowerCase() : '';
  for (const key of RAW_HTML_URL_ATTRIBUTES_BY_TAG[tagName] ?? []) {
    if (!Object.prototype.hasOwnProperty.call(node.properties, key)) {
      continue;
    }

    const normalized = normalizeRawHtmlUrlAttribute(tagName, key, String(node.properties[key] ?? ''));
    if (normalized) {
      node.properties[key] = normalized;
    } else {
      delete node.properties[key];
    }
  }

  if (tagName === 'iframe') {
    if (!node.properties.src) {
      node.tagName = 'span';
      node.properties = {};
      node.children = [];
      return;
    }
    node.properties.sandbox = sanitizeGithubIframeSandbox(String(node.properties.sandbox ?? ''));
    node.properties.referrerPolicy = typeof node.properties.referrerPolicy === 'string'
      ? node.properties.referrerPolicy
      : 'no-referrer';
  }
}
