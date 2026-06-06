import DOMPurify from 'dompurify';
import { themeColorTokens, themeMermaidTokens } from '@/styles/themeTokens';

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

function stripExternalSvgResourceReferences(markup: string) {
  if (!/url\(|href=/i.test(markup)) {
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
  const urlPattern = /url\(\s*(['"]?)(.*?)\1\s*\)/gi;
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

  const paragraphs = Array.from(labelElement.querySelectorAll('p'))
    .flatMap(extractElementTextLines)
    .filter((line) => line.length > 0);
  if (paragraphs.length > 0) {
    return paragraphs;
  }

  return extractElementTextLines(labelElement);
}

function extractElementTextLines(element: Element) {
  const clone = element.cloneNode(true) as Element;
  clone.querySelectorAll('br').forEach((br) => {
    br.replaceWith(clone.ownerDocument.createTextNode('\n'));
  });
  return (clone.textContent || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
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
