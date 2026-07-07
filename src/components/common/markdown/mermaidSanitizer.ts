import DOMPurify from 'dompurify';
import {
  containsExternalSvgStyleElementReference,
  containsExternalSvgUrlReference,
  isLocalSvgReference,
  removeExternalSvgStyleDeclarations,
} from '@/lib/markdown/svgResourceReferences';
import { replaceMermaidForeignObjectLabels } from './mermaidForeignObjectLabels';
import { walkBudgetedSvgElements } from './mermaidSanitizerBudget';

const MAX_MERMAID_MARKUP_CHARS = 2 * 1024 * 1024;
const MERMAID_FORBIDDEN_TAGS = ['foreignObject', 'script', 'iframe', 'object', 'embed'];
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
  const withinBudget = walkBudgetedSvgElements(template.content, (element) => {
    if (element.localName.toLowerCase() === 'svg') {
      element.classList.add('mermaid-svg');
    }
  });
  if (!withinBudget) {
    return '';
  }
  return template.innerHTML;
}

function stripExternalSvgResourceReferences(markup: string) {
  if (typeof document === 'undefined') {
    return markup;
  }

  const template = document.createElement('template');
  template.innerHTML = markup;
  const withinBudget = walkBudgetedSvgElements(template.content, (element) => {
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

function removeExternalHref(element: Element) {
  for (const attributeName of ['href', 'xlink:href']) {
    const value = element.getAttribute(attributeName);
    if (value && !isLocalSvgReference(value)) {
      element.removeAttribute(attributeName);
    }
  }
}

function sanitizeSvgStyleAttribute(style: string) {
  const filteredStyle = removeExternalSvgStyleDeclarations(style);
  if (!filteredStyle) {
    return '';
  }

  const scratch = document.createElement('span');
  scratch.setAttribute('style', filteredStyle);

  for (let index = scratch.style.length - 1; index >= 0; index -= 1) {
    const propertyName = scratch.style.item(index);
    if (containsExternalSvgUrlReference(scratch.style.getPropertyValue(propertyName))) {
      scratch.style.removeProperty(propertyName);
    }
  }
  const serialized = scratch.style.cssText || scratch.getAttribute('style') || filteredStyle;
  return containsExternalSvgUrlReference(serialized) ? '' : serialized;
}
