import { resolveMathEditorOpenState } from './mathEditorOpenResolver';
import { getMathAnchorViewportPosition, resolveMathAnchorElement } from './mathEditorPlacement';
import type { MathEditorState } from './types';

const MATH_NODE_SELECTOR = '[data-type="math-block"], [data-type="math-inline"]';

interface MathEditorPluginViewLike {
  state: {
    doc: {
      resolve: (pos: number) => unknown;
      nodeAt: (pos: number) => unknown;
    };
  };
  dom: HTMLElement;
  posAtDOM: (node: Node, offset: number) => number;
  nodeDOM?: (pos: number) => Node | null;
}

export function findMathEditorTargetElement(
  view: { dom: HTMLElement },
  target: EventTarget | null
) {
  const targetElement =
    target instanceof HTMLElement ? target : target instanceof Node ? target.parentElement : null;
  const mathElement = targetElement?.closest(MATH_NODE_SELECTOR);

  if (!(mathElement instanceof HTMLElement) || !view.dom.contains(mathElement)) {
    return null;
  }

  return mathElement;
}

export function isHorizontalScrollbarPointerDown(args: {
  event: MouseEvent;
  mathElement: HTMLElement;
}) {
  const { event, mathElement } = args;
  if (typeof window === 'undefined' || mathElement.dataset.type !== 'math-block') {
    return false;
  }

  const target = event.target instanceof HTMLElement ? event.target : null;
  let current: HTMLElement | null = target;

  while (current) {
    const overflowX = window.getComputedStyle(current).overflowX;
    const scrollbarHeight = current.offsetHeight - current.clientHeight;
    const hasHorizontalScrollbar =
      (overflowX === 'auto' || overflowX === 'scroll') &&
      current.scrollWidth > current.clientWidth &&
      scrollbarHeight > 0;

    if (hasHorizontalScrollbar) {
      const rect = current.getBoundingClientRect();
      const hitHorizontalScrollbar =
        event.clientX >= rect.left &&
        event.clientX <= rect.right &&
        event.clientY >= rect.bottom - scrollbarHeight &&
        event.clientY <= rect.bottom;

      if (hitHorizontalScrollbar) {
        return true;
      }
    }

    if (current === mathElement) {
      break;
    }

    current = current.parentElement;
  }

  return false;
}

export function resolveMathEditorOpenMeta(args: {
  view: MathEditorPluginViewLike;
  pos: number;
  target: EventTarget | null;
}): MathEditorState | null {
  const { view, pos, target } = args;

  return resolveMathEditorOpenState({
    view: view as never,
    pos,
    getPosition(nodePos: number) {
      return getMathAnchorViewportPosition(
        resolveMathAnchorElement(
          target,
          typeof view.nodeDOM === 'function' ? view.nodeDOM(nodePos) : null
        )
      );
    },
  });
}

export function resolveMathEditorPointerOpen(args: {
  view: MathEditorPluginViewLike;
  target: EventTarget | null;
}) {
  const { view, target } = args;
  const mathElement = findMathEditorTargetElement(view, target);
  if (!mathElement) {
    return null;
  }

  try {
    const meta = resolveMathEditorOpenMeta({
      view,
      pos: view.posAtDOM(mathElement, 0),
      target,
    });

    if (!meta) {
      return null;
    }

    return { mathElement, meta };
  } catch {
    return null;
  }
}
