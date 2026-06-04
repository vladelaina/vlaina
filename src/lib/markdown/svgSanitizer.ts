import DOMPurify from 'dompurify';

const SVG_FORBIDDEN_TAGS = ['foreignObject', 'script', 'iframe', 'object', 'embed'];
const SVG_RESOURCE_HREF_TAGS = new Set([
  'feimage',
  'filter',
  'image',
  'lineargradient',
  'pattern',
  'radialgradient',
  'textpath',
  'use',
]);
const SVG_URL_REFERENCE_ATTRIBUTES = new Set([
  'clip-path',
  'color-profile',
  'cursor',
  'filter',
  'fill',
  'marker',
  'marker-end',
  'marker-mid',
  'marker-start',
  'mask',
  'stroke',
]);

function containsExternalSvgUrlReference(value: string): boolean {
  const urlPattern = /url\s*\(\s*(['"]?)(.*?)\1\s*\)/gi;
  let match: RegExpExecArray | null;
  while ((match = urlPattern.exec(value)) !== null) {
    if (!isLocalSvgReference(match[2] || '')) {
      return true;
    }
  }
  return false;
}

function isLocalSvgReference(value: string): boolean {
  return value.trim().startsWith('#');
}

function removeExternalHref(element: Element): void {
  for (const attributeName of ['href', 'xlink:href']) {
    const value = element.getAttribute(attributeName);
    if (value && !isLocalSvgReference(value)) {
      element.removeAttribute(attributeName);
    }
  }
}

function sanitizeSvgStyleAttribute(style: string): string {
  const scratch = document.createElement('span');
  scratch.setAttribute('style', style);

  for (let index = scratch.style.length - 1; index >= 0; index -= 1) {
    const propertyName = scratch.style.item(index);
    if (containsExternalSvgUrlReference(scratch.style.getPropertyValue(propertyName))) {
      scratch.style.removeProperty(propertyName);
    }
  }
  return scratch.getAttribute('style') || '';
}

function stripExternalSvgResourceReferences(markup: string): string {
  if (!/url\s*\(|href\s*=/i.test(markup) || typeof document === 'undefined') {
    return markup;
  }

  const template = document.createElement('template');
  template.innerHTML = markup;
  template.content.querySelectorAll('*').forEach((element) => {
    const tagName = element.localName.toLowerCase();
    if (SVG_RESOURCE_HREF_TAGS.has(tagName)) {
      removeExternalHref(element);
    }

    for (const attributeName of SVG_URL_REFERENCE_ATTRIBUTES) {
      const value = element.getAttribute(attributeName);
      if (value && containsExternalSvgUrlReference(value)) {
        element.removeAttribute(attributeName);
      }
    }

    const style = element.getAttribute('style');
    if (style) {
      const sanitizedStyle = sanitizeSvgStyleAttribute(style);
      if (sanitizedStyle) {
        element.setAttribute('style', sanitizedStyle);
      } else {
        element.removeAttribute('style');
      }
    }
  });
  return template.innerHTML;
}

export function sanitizeSvgMarkup(markup: string): string {
  return stripExternalSvgResourceReferences(DOMPurify.sanitize(markup, {
    USE_PROFILES: { svg: true, svgFilters: true },
    FORBID_TAGS: SVG_FORBIDDEN_TAGS,
  }));
}

export function sanitizeSvgBytes(data: Uint8Array): Uint8Array {
  return new TextEncoder().encode(sanitizeSvgMarkup(new TextDecoder().decode(data)));
}
