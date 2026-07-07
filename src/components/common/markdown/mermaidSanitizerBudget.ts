const MAX_MERMAID_SANITIZE_DEPTH = 200;
const MAX_MERMAID_SANITIZE_NODES = 20_000;

interface SvgElementVisit {
  element: Element;
  depth: number;
}

export function walkBudgetedSvgElements(
  root: DocumentFragment | Element,
  visitElement: (element: Element) => void
) {
  const firstElement = root instanceof Element ? root : root.firstElementChild;
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

export function isOutsideMermaidSanitizeBudget(visitedNodes: number, depth: number) {
  return visitedNodes > MAX_MERMAID_SANITIZE_NODES || depth > MAX_MERMAID_SANITIZE_DEPTH;
}
