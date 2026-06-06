import DOMPurify from 'dompurify';
import { themeColorTokens, themeMermaidTokens } from '@/styles/themeTokens';

const MAX_MERMAID_SANITIZE_DEPTH = 200;
const MAX_MERMAID_SANITIZE_NODES = 20_000;
const MAX_MERMAID_MARKUP_CHARS = 2 * 1024 * 1024;
const MAX_MERMAID_LABEL_TEXT_CHARS = 8192;
const MAX_MERMAID_LABEL_LINES = 64;
const MERMAID_FORBIDDEN_TAGS = ['foreignObject', 'script', 'iframe', 'object', 'embed'];
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

export function sanitizeMermaidMarkup(markup: string) {
  if (markup.length > MAX_MERMAID_MARKUP_CHARS) {
    return '';
  }

  return addMermaidCompatibilitySvgClass(
    stripExternalSvgResourceReferences(
      DOMPurify.sanitize(replaceMermaidForeignObjectLabels(markup), {
        USE_PROFILES: { html: true, svg: true, svgFilters: true },
        FORBID_TAGS: MERMAID_FORBIDDEN_TAGS,
      })
    )
  );
}

function addMermaidCompatibilitySvgClass(markup: string) {
  if (!/<svg\b/i.test(markup)) {
    return markup;
  }

  const template = document.createElement('template');
  template.innerHTML = markup;
  template.content.querySelectorAll('svg').forEach((svg) => {
    svg.classList.add('mermaid-svg');
  });
  return template.innerHTML;
}

function walkBudgetedSvgElements(
  root: DocumentFragment | Element,
  visitElement: (element: Element) => void
) {
  const firstElement = root.firstElementChild;
  if (!firstElement) {
    return true;
  }

  let visitedNodes = 0;
  const stack: SvgElementVisit[] = [{ element: firstElement, depth: 1 }];
  while (stack.length > 0) {
    const { element, depth } = stack.pop() as SvgElementVisit;
    visitedNodes += 1;
    if (visitedNodes > MAX_MERMAID_SANITIZE_NODES || depth > MAX_MERMAID_SANITIZE_DEPTH) {
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

function stripExternalSvgResourceReferences(markup: string) {
  if (typeof document === 'undefined') {
    return markup;
  }

  const template = document.createElement('template');
  template.innerHTML = markup;
  const shouldStripResourceReferences = /url\s*\(|href\s*=/i.test(markup);
  const withinBudget = walkBudgetedSvgElements(template.content, (element) => {
    if (!shouldStripResourceReferences) {
      return;
    }

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
  if (!withinBudget) {
    return '';
  }
  return template.innerHTML;
}

function removeExternalHref(element: Element) {
  for (const attributeName of ['href', 'xlink:href']) {
    const value = element.getAttribute(attributeName);
    if (value && !isLocalSvgReference(value)) {
      element.removeAttribute(attributeName);
    }
  }
}

function sanitizeSvgStyleAttribute(style: string) {
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

function containsExternalSvgUrlReference(value: string) {
  const urlPattern = /url\s*\(\s*(['"]?)(.*?)\1\s*\)/gi;
  let match: RegExpExecArray | null;
  while ((match = urlPattern.exec(value)) !== null) {
    if (!isLocalSvgReference(match[2] || '')) {
      return true;
    }
  }
  return false;
}

function isLocalSvgReference(value: string) {
  return value.trim().startsWith('#');
}

function replaceMermaidForeignObjectLabels(markup: string) {
  if (!markup.includes('<foreignObject')) {
    return markup;
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(markup, 'image/svg+xml');
  if (doc.querySelector('parsererror')) {
    return markup;
  }
  if (!walkBudgetedSvgElements(doc.documentElement, () => undefined)) {
    return '';
  }

  doc.querySelectorAll('foreignObject').forEach((foreignObject) => {
    foreignObject.querySelectorAll('script, style').forEach((node) => node.remove());
    const labelElement = foreignObject.querySelector('.nodeLabel');
    const lines = extractMermaidLabelLines(labelElement);
    if (lines.length === 0) {
      foreignObject.remove();
      return;
    }

    const text = doc.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('class', 'nodeLabel');
    text.setAttribute('x', resolveForeignObjectCenterCoord(foreignObject, 'x', 'width'));
    text.setAttribute('y', resolveForeignObjectCenterCoord(foreignObject, 'y', 'height'));
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('fill', themeColorTokens.mermaidText);

    const firstLineDy = lines.length > 1
      ? `${themeMermaidTokens.labelFirstLineBaseDyEm - ((lines.length - 1) * themeMermaidTokens.labelLineOffsetEm)}em`
      : themeMermaidTokens.labelSingleLineDy;
    lines.forEach((line, index) => {
      const tspan = doc.createElementNS('http://www.w3.org/2000/svg', 'tspan');
      tspan.setAttribute('x', text.getAttribute('x') || '0');
      tspan.setAttribute('dy', index === 0 ? firstLineDy : themeMermaidTokens.labelNextLineDy);
      tspan.textContent = line;
      text.appendChild(tspan);
    });

    foreignObject.replaceWith(text);
  });

  return new XMLSerializer().serializeToString(doc.documentElement);
}

function extractMermaidLabelLines(labelElement: Element | null) {
  if (!labelElement) {
    return [];
  }

  const paragraphs: string[] = [];
  for (const paragraph of labelElement.querySelectorAll('p')) {
    if (!appendElementTextLines(paragraph, paragraphs)) {
      return [];
    }
    if (paragraphs.length >= MAX_MERMAID_LABEL_LINES) {
      break;
    }
  }
  if (paragraphs.length > 0) {
    return paragraphs;
  }

  const lines: string[] = [];
  return appendElementTextLines(labelElement, lines) ? lines : [];
}

function appendElementTextLines(element: Element, lines: string[]) {
  if ((element.textContent || '').length > MAX_MERMAID_LABEL_TEXT_CHARS) {
    return false;
  }

  const clone = element.cloneNode(true) as Element;
  clone.querySelectorAll('br').forEach((br) => {
    br.replaceWith(clone.ownerDocument.createTextNode('\n'));
  });
  for (const line of (clone.textContent || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)) {
    lines.push(line);
    if (lines.length >= MAX_MERMAID_LABEL_LINES) {
      break;
    }
  }
  return true;
}

function resolveForeignObjectCenterCoord(
  foreignObject: Element,
  startAttr: 'x' | 'y',
  sizeAttr: 'width' | 'height'
) {
  const start = Number.parseFloat(foreignObject.getAttribute(startAttr) || '0');
  const size = Number.parseFloat(foreignObject.getAttribute(sizeAttr) || '0');
  const center = start + (Number.isFinite(size) ? size / 2 : 0);
  return Number.isFinite(center) ? String(center) : '0';
}
