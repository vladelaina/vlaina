import { themeColorTokens, themeMermaidTokens } from '@/styles/themeTokens';
import {
  isOutsideMermaidSanitizeBudget,
  walkBudgetedSvgElements,
} from './mermaidSanitizerBudget';

const MAX_MERMAID_LABEL_TEXT_CHARS = 8192;
const MAX_MERMAID_LABEL_LINES = 64;

interface NodeTextVisit {
  node: Node;
  depth: number;
}

export function replaceMermaidForeignObjectLabels(markup: string) {
  if (!markup.includes('<foreignObject')) {
    return markup;
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(markup, 'image/svg+xml');
  const foreignObjects: Element[] = [];
  let hasParserError = false;
  const withinBudget = walkBudgetedSvgElements(doc.documentElement, (element) => {
    const tagName = element.localName.toLowerCase();
    if (tagName === 'parsererror') {
      hasParserError = true;
    } else if (tagName === 'foreignobject') {
      foreignObjects.push(element);
    }
  });
  if (hasParserError) {
    return markup;
  }
  if (!withinBudget) {
    return '';
  }

  foreignObjects.forEach((foreignObject) => {
    removeDescendantElementsByLocalName(foreignObject, new Set(['script', 'style']));
    const labelElement = findFirstElementWithClass(foreignObject, 'nodeLabel');
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
  let paragraphsWithinBudget = true;
  const withinParagraphBudget = walkBudgetedSvgElements(labelElement, (element) => {
    if (!paragraphsWithinBudget || element === labelElement || paragraphs.length >= MAX_MERMAID_LABEL_LINES) {
      return;
    }
    if (element.localName.toLowerCase() === 'p') {
      paragraphsWithinBudget = appendElementTextLines(element, paragraphs);
    }
  });
  if (!withinParagraphBudget || !paragraphsWithinBudget) {
    return [];
  }
  if (paragraphs.length > 0) {
    return paragraphs;
  }

  const lines: string[] = [];
  return appendElementTextLines(labelElement, lines) ? lines : [];
}

function appendElementTextLines(element: Element, lines: string[]) {
  const text = collectElementTextWithBreaks(element);
  if (text === null) {
    return false;
  }

  for (const line of text
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

function removeDescendantElementsByLocalName(root: Element, localNames: Set<string>) {
  const elementsToRemove: Element[] = [];
  walkBudgetedSvgElements(root, (element) => {
    if (element !== root && localNames.has(element.localName.toLowerCase())) {
      elementsToRemove.push(element);
    }
  });
  elementsToRemove.forEach((element) => element.remove());
}

function findFirstElementWithClass(root: Element, className: string) {
  let found: Element | null = null;
  walkBudgetedSvgElements(root, (element) => {
    if (!found && element.classList.contains(className)) {
      found = element;
    }
  });
  return found;
}

function collectElementTextWithBreaks(element: Element) {
  let text = '';
  let visitedNodes = 0;
  const stack: NodeTextVisit[] = [{ node: element, depth: 1 }];

  while (stack.length > 0) {
    const { node, depth } = stack.pop() as NodeTextVisit;
    visitedNodes += 1;
    if (isOutsideMermaidSanitizeBudget(visitedNodes, depth)) {
      return null;
    }

    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent || '';
      if (text.length > MAX_MERMAID_LABEL_TEXT_CHARS) {
        return null;
      }
      continue;
    }

    if (node instanceof Element && node.localName.toLowerCase() === 'br') {
      text += '\n';
      if (text.length > MAX_MERMAID_LABEL_TEXT_CHARS) {
        return null;
      }
      continue;
    }

    for (let child = node.lastChild; child; child = child.previousSibling) {
      stack.push({ node: child, depth: depth + 1 });
    }
  }

  return text;
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
