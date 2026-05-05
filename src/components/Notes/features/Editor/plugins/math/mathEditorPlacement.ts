import { resolveTextEditorPopupPlacement } from '../shared/textEditorPopupPlacement';

const MATH_NODE_SELECTOR = '[data-type="math-block"], [data-type="math-inline"]';

export function resolveMathAnchorElement(target: EventTarget | null, fallback: Node | null) {
  const targetElement =
    target instanceof Element ? target : target instanceof Node ? target.parentElement : null;
  const closestMathElement = targetElement?.closest(MATH_NODE_SELECTOR);

  if (closestMathElement instanceof HTMLElement) {
    return closestMathElement;
  }

  if (fallback instanceof HTMLElement) {
    return fallback;
  }

  return targetElement instanceof HTMLElement ? targetElement : null;
}

export function getMathAnchorViewportPosition(anchorElement: HTMLElement | null) {
  if (!anchorElement) {
    return { x: 16, y: 16 };
  }

  const rect = anchorElement.getBoundingClientRect();
  return {
    x: rect.left,
    y: rect.bottom + 8,
  };
}

export function resolveMathEditorPlacement(args: {
  editorView: { dom: HTMLElement };
  positionRoot: HTMLElement | null;
  viewportPosition: { x: number; y: number };
}) {
  return resolveTextEditorPopupPlacement(args);
}
