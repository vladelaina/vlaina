import { getContentLayoutContext } from '../floating-toolbar/floatingToolbarLayout';
import { toContainerPosition } from '../floating-toolbar/floatingToolbarDom';

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
  const { editorView, positionRoot, viewportPosition } = args;
  const containerPosition = toContainerPosition(viewportPosition, positionRoot);
  const layout = getContentLayoutContext(editorView as never, positionRoot);
  const margin = 12;
  const bounds = layout.containerBounds
    ? {
        left: layout.containerBounds.left,
        right: layout.containerBounds.right,
      }
    : positionRoot
      ? {
          left: margin,
          right: positionRoot.clientWidth - margin,
        }
      : {
          left: margin,
          right: window.innerWidth - margin,
        };
  const width = Math.max(0, bounds.right - bounds.left);

  return {
    x: bounds.left,
    y: containerPosition.y,
    width,
  };
}
