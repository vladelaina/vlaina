import { resolveMermaidEditorOpenState } from './mermaidEditorOpenResolver';
import type { MermaidEditorState } from './types';

const MERMAID_NODE_SELECTOR = '[data-type="mermaid"]';

interface MermaidEditorPluginViewLike {
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

export function resolveMermaidAnchorElement(target: EventTarget | null, fallback: Node | null) {
  const targetElement =
    target instanceof Element ? target : target instanceof Node ? target.parentElement : null;
  const closestMermaidElement = targetElement?.closest(MERMAID_NODE_SELECTOR);

  if (closestMermaidElement instanceof HTMLElement) {
    return closestMermaidElement;
  }

  if (fallback instanceof HTMLElement) {
    return fallback;
  }

  return targetElement instanceof HTMLElement ? targetElement : null;
}

export function getMermaidAnchorViewportPosition(anchorElement: HTMLElement | null) {
  if (!anchorElement) {
    return { x: 16, y: 16 };
  }

  const rect = anchorElement.getBoundingClientRect();
  return {
    x: rect.left,
    y: rect.bottom + 8,
  };
}

export function findMermaidEditorTargetElement(
  view: { dom: HTMLElement },
  target: EventTarget | null
) {
  const targetElement =
    target instanceof HTMLElement ? target : target instanceof Node ? target.parentElement : null;
  const mermaidElement = targetElement?.closest(MERMAID_NODE_SELECTOR);

  if (!(mermaidElement instanceof HTMLElement) || !view.dom.contains(mermaidElement)) {
    return null;
  }

  return mermaidElement;
}

export function isMermaidScrollbarPointerDown(args: {
  event: MouseEvent;
  mermaidElement: HTMLElement;
}) {
  const { event, mermaidElement } = args;
  if (typeof window === 'undefined') {
    return false;
  }

  const overflowX = window.getComputedStyle(mermaidElement).overflowX;
  const scrollbarHeight = mermaidElement.offsetHeight - mermaidElement.clientHeight;
  const hasHorizontalScrollbar =
    (overflowX === 'auto' || overflowX === 'scroll') &&
    mermaidElement.scrollWidth > mermaidElement.clientWidth &&
    scrollbarHeight > 0;

  if (!hasHorizontalScrollbar) {
    return false;
  }

  const rect = mermaidElement.getBoundingClientRect();
  return (
    event.clientX >= rect.left &&
    event.clientX <= rect.right &&
    event.clientY >= rect.bottom - scrollbarHeight &&
    event.clientY <= rect.bottom
  );
}

export function resolveMermaidEditorOpenMeta(args: {
  view: MermaidEditorPluginViewLike;
  pos: number;
  target: EventTarget | null;
}): MermaidEditorState | null {
  const { view, pos, target } = args;

  return resolveMermaidEditorOpenState({
    view: view as never,
    pos,
    getPosition(nodePos: number) {
      return getMermaidAnchorViewportPosition(
        resolveMermaidAnchorElement(
          target,
          typeof view.nodeDOM === 'function' ? view.nodeDOM(nodePos) : null
        )
      );
    },
  });
}

export function resolveMermaidEditorPointerOpen(args: {
  view: MermaidEditorPluginViewLike;
  target: EventTarget | null;
}) {
  const { view, target } = args;
  const mermaidElement = findMermaidEditorTargetElement(view, target);
  if (!mermaidElement) {
    return null;
  }

  try {
    const meta = resolveMermaidEditorOpenMeta({
      view,
      pos: view.posAtDOM(mermaidElement, 0),
      target,
    });

    if (!meta) {
      return null;
    }

    return { mermaidElement, meta };
  } catch {
    return null;
  }
}
