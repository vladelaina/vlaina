import DOMPurify from 'dompurify';

export const MAX_SVG_SANITIZE_MARKUP_CHARS = 50 * 1024 * 1024;
export const MAX_SVG_SANITIZE_BYTES = MAX_SVG_SANITIZE_MARKUP_CHARS;
const MAX_SVG_SANITIZE_DEPTH = 200;
const MAX_SVG_SANITIZE_NODES = 20_000;
const SVG_FORBIDDEN_TAGS = ['foreignObject', 'script', 'iframe', 'object', 'embed'];
interface SvgElementVisit {
  element: Element;
  depth: number;
}
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

function containsExternalSvgStyleElementReference(value: string): boolean {
  return /@import/i.test(value) || containsExternalSvgUrlReference(value);
}

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

function walkBudgetedSvgElements(
  root: DocumentFragment | Element,
  visitElement: (element: Element) => void
): boolean {
  const firstElement = root.firstElementChild;
  if (!firstElement) {
    return true;
  }

  let visitedNodes = 0;
  const stack: SvgElementVisit[] = [{ element: firstElement, depth: 1 }];
  while (stack.length > 0) {
    const { element, depth } = stack.pop() as SvgElementVisit;
    visitedNodes += 1;
    if (visitedNodes > MAX_SVG_SANITIZE_NODES || depth > MAX_SVG_SANITIZE_DEPTH) {
      return false;
    }

    const nextElement = element.nextElementSibling;
    if (nextElement) {
      stack.push({ element: nextElement, depth });
    }

    const firstChild = element.firstElementChild;
    if (firstChild) {
      stack.push({ element: firstChild, depth: depth + 1 });
    }

    visitElement(element);
  }

  return true;
}

function stripExternalSvgResourceReferences(markup: string): string {
  if (typeof document === 'undefined') {
    return markup;
  }

  const template = document.createElement('template');
  template.innerHTML = markup;
  const shouldStripResourceReferences = /url\s*\(|href\s*=|@import/i.test(markup);
  const withinBudget = walkBudgetedSvgElements(template.content, (element) => {
    if (!shouldStripResourceReferences) {
      return;
    }

    if (element.localName.toLowerCase() === 'style') {
      if (containsExternalSvgStyleElementReference(element.textContent || '')) {
        element.remove();
      }
      return;
    }

    removeExternalHref(element);

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
  if (!withinBudget) {
    return '';
  }
  return template.innerHTML;
}

export function sanitizeSvgMarkup(markup: string): string {
  if (markup.length > MAX_SVG_SANITIZE_MARKUP_CHARS) {
    return '';
  }

  return stripExternalSvgResourceReferences(DOMPurify.sanitize(markup, {
    USE_PROFILES: { svg: true, svgFilters: true },
    FORBID_TAGS: SVG_FORBIDDEN_TAGS,
  }));
}

export function sanitizeSvgBytes(data: Uint8Array): Uint8Array {
  if (data.byteLength > MAX_SVG_SANITIZE_BYTES) {
    return new Uint8Array();
  }

  return new TextEncoder().encode(sanitizeSvgMarkup(new TextDecoder().decode(data)));
}
