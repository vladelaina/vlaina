const ALLOWED_TAGS = new Set([
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'p', 'br', 'hr',
  'b', 'strong', 'i', 'em', 'u', 's', 'strike', 'blockquote',
  'ul', 'ol', 'li',
  'a', 'img',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'iframe',
]);

const DROP_WITH_CONTENT_TAGS = new Set(['script', 'style', 'meta']);
const RELATIVE_URL_PREFIXES = ['/', './', '../', '#'];
const ALLOWED_EXTERNAL_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);
const ALLOWED_IMAGE_PROTOCOLS = new Set(['http:', 'https:', 'data:', 'blob:', 'asset:']);
const ALLOWED_IFRAME_PROTOCOLS = new Set(['http:', 'https:']);
const FORBIDDEN_IFRAME_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]']);
const SAFE_IMAGE_DATA_URL_PATTERN = /^data:image\/(?:png|apng|gif|jpeg|jpg|webp|bmp|x-icon|vnd\.microsoft\.icon);base64,[a-z0-9+/=]+$/i;
const CONTROL_OR_BIDI_CHAR_PATTERN = /[\u0000-\u001F\u007F\u202A-\u202E\u2066-\u2069\uFFFD]/;
export const SANDBOXED_IFRAME_SANDBOX = 'allow-scripts allow-forms allow-popups allow-presentation';

function isRelativeUrl(value: string): boolean {
  return RELATIVE_URL_PREFIXES.some((prefix) => value.startsWith(prefix));
}

function normalizeUrl(
  value: string,
  allowedProtocols: ReadonlySet<string>,
  options?: {
    allowRelative?: boolean;
    blockLocalHosts?: boolean;
  },
): string | null {
  const trimmed = value.trim();
  if (!trimmed || /\s/.test(trimmed) || CONTROL_OR_BIDI_CHAR_PATTERN.test(trimmed)) {
    return null;
  }

  if (options?.allowRelative && isRelativeUrl(trimmed)) {
    return trimmed;
  }

  try {
    const base = typeof window !== 'undefined' ? window.location.href : 'https://vlaina.local/';
    const url = new URL(trimmed, base);
    if (!allowedProtocols.has(url.protocol)) {
      return null;
    }
    if (options?.blockLocalHosts && isForbiddenIframeHost(url.hostname)) {
      return null;
    }
    return url.href;
  } catch {
    return null;
  }
}

function isPrivateIpv4Host(hostname: string): boolean {
  const match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!match) {
    return false;
  }

  const octets = match.slice(1).map(Number);
  if (octets.some((octet) => octet < 0 || octet > 255)) {
    return false;
  }

  const [a, b] = octets;
  return (
    a === 10
    || a === 127
    || a === 0
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168)
  );
}

function isPrivateIpv6Host(hostname: string): boolean {
  const normalized = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  return (
    normalized === '::1'
    || normalized.startsWith('fe80:')
    || normalized.startsWith('fc')
    || normalized.startsWith('fd')
  );
}

function isForbiddenIframeHost(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase();
  return (
    FORBIDDEN_IFRAME_HOSTS.has(normalized)
    || isPrivateIpv4Host(normalized)
    || isPrivateIpv6Host(normalized)
  );
}

function sanitizeHref(value: string): string | null {
  return normalizeUrl(value, ALLOWED_EXTERNAL_PROTOCOLS, { allowRelative: true });
}

function sanitizeImageSrc(value: string): string | null {
  const normalized = normalizeUrl(value, ALLOWED_IMAGE_PROTOCOLS, { allowRelative: true });
  if (!normalized) {
    return null;
  }

  if (normalized.startsWith('data:')) {
    return SAFE_IMAGE_DATA_URL_PATTERN.test(normalized) ? normalized : null;
  }

  return normalized;
}

function sanitizeIframeSrc(value: string): string | null {
  return normalizeUrl(value, ALLOWED_IFRAME_PROTOCOLS, { blockLocalHosts: true });
}

function isForbiddenAttribute(attributeName: string): boolean {
  const normalizedName = attributeName.toLowerCase();
  return (
    normalizedName.startsWith('on')
    || normalizedName === 'class'
    || normalizedName === 'id'
    || normalizedName === 'style'
    || normalizedName === 'srcdoc'
    || normalizedName.startsWith('data-')
  );
}

function sanitizeChildren(source: Element | DocumentFragment, target: Element | DocumentFragment): void {
  for (const child of Array.from(source.childNodes)) {
    const sanitizedChild = sanitizeNode(child);
    if (sanitizedChild) {
      target.appendChild(sanitizedChild);
    }
  }
}

function sanitizeAnchor(element: HTMLAnchorElement): HTMLAnchorElement {
  const anchor = document.createElement('a');
  const href = element.getAttribute('href');
  const target = element.getAttribute('target');
  let hasSafeHref = false;

  sanitizeChildren(element, anchor);

  if (href) {
    const normalizedHref = sanitizeHref(href);
    if (normalizedHref) {
      anchor.setAttribute('href', normalizedHref);
      hasSafeHref = true;
    }
  }

  if (hasSafeHref && target === '_blank') {
    anchor.setAttribute('target', '_blank');
    anchor.setAttribute('rel', 'noopener noreferrer');
  }

  if (anchor.childNodes.length === 0 && element.textContent) {
    anchor.textContent = element.textContent;
  }

  return anchor;
}

function sanitizeImage(element: HTMLImageElement): HTMLImageElement | null {
  const src = element.getAttribute('src');
  if (!src) {
    return null;
  }

  const normalizedSrc = sanitizeImageSrc(src);
  if (!normalizedSrc) {
    return null;
  }

  const image = document.createElement('img');
  image.setAttribute('src', normalizedSrc);

  const alt = element.getAttribute('alt');
  if (alt) {
    image.setAttribute('alt', alt);
  }

  const title = element.getAttribute('title');
  if (title) {
    image.setAttribute('title', title);
  }

  return image;
}

function sanitizeIframe(element: HTMLIFrameElement): HTMLIFrameElement | null {
  const src = element.getAttribute('src');
  if (!src) {
    return null;
  }

  const normalizedSrc = sanitizeIframeSrc(src);
  if (!normalizedSrc) {
    return null;
  }

  const iframe = document.createElement('iframe');
  iframe.setAttribute('src', normalizedSrc);
  iframe.setAttribute('sandbox', SANDBOXED_IFRAME_SANDBOX);
  iframe.setAttribute('referrerpolicy', 'no-referrer');
  iframe.setAttribute('loading', 'lazy');

  for (const attributeName of ['title', 'width', 'height', 'frameborder', 'allow', 'scrolling']) {
    const value = element.getAttribute(attributeName);
    if (value) {
      iframe.setAttribute(attributeName, value);
    }
  }

  if (element.hasAttribute('allowfullscreen')) {
    iframe.setAttribute('allowfullscreen', '');
  }

  return iframe;
}

function sanitizeElement(element: Element): Node | null {
  const tagName = element.tagName.toLowerCase();

  if (DROP_WITH_CONTENT_TAGS.has(tagName)) {
    return null;
  }

  if (!ALLOWED_TAGS.has(tagName)) {
    const fragment = document.createDocumentFragment();
    sanitizeChildren(element, fragment);
    return fragment;
  }

  if (element instanceof HTMLAnchorElement) {
    return sanitizeAnchor(element);
  }

  if (element instanceof HTMLImageElement) {
    return sanitizeImage(element);
  }

  if (element instanceof HTMLIFrameElement) {
    return sanitizeIframe(element);
  }

  const sanitized = document.createElement(tagName);
  for (const attributeName of element.getAttributeNames()) {
    if (isForbiddenAttribute(attributeName)) {
      continue;
    }

    const value = element.getAttribute(attributeName);
    if (!value) {
      continue;
    }

    if (attributeName === 'start' && tagName === 'ol') {
      sanitized.setAttribute('start', value);
      continue;
    }

    if (attributeName === 'type') {
      sanitized.setAttribute('type', value);
      continue;
    }

    if (attributeName === 'checked') {
      sanitized.setAttribute('checked', value);
    }
  }

  sanitizeChildren(element, sanitized);
  return sanitized;
}

function sanitizeNode(node: Node): Node | null {
  if (node.nodeType === Node.TEXT_NODE) {
    return document.createTextNode(node.textContent ?? '');
  }

  if (node.nodeType === Node.ELEMENT_NODE) {
    return sanitizeElement(node as Element);
  }

  return null;
}

export function sanitizeHtml(html: string): string {
  if (!html) return html;

  try {
    const template = document.createElement('template');
    template.innerHTML = html;

    const output = document.createElement('template');
    sanitizeChildren(template.content, output.content);
    return output.innerHTML;
  } catch (e) {
    console.error('[Clipboard/Sanitizer] Failed to sanitize HTML:', e);
    return html;
  }
}
