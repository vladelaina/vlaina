import { themeDomStyleTokens } from '@/styles/themeTokens';
import {
  createOpenHtmlBlockEditorState,
  HTML_BLOCK_SELECTOR,
  isEditableHtmlBlockValue,
  type HtmlBlockEditorState,
  type HtmlBlockEditorViewLike,
} from './htmlBlockEditorState';

export function findHtmlBlockEditorTargetElement(
  view: { dom: HTMLElement },
  target: EventTarget | null
) {
  const targetElement =
    target instanceof HTMLElement ? target : target instanceof Node ? target.parentElement : null;
  const htmlBlockElement = targetElement?.closest(HTML_BLOCK_SELECTOR);

  if (!(htmlBlockElement instanceof HTMLElement) || !view.dom.contains(htmlBlockElement)) {
    return null;
  }

  return htmlBlockElement;
}

export function resolveHtmlBlockAnchorElement(target: EventTarget | null, fallback: Node | null) {
  const targetElement =
    target instanceof Element ? target : target instanceof Node ? target.parentElement : null;
  const closestHtmlBlockElement = targetElement?.closest(HTML_BLOCK_SELECTOR);

  if (closestHtmlBlockElement instanceof HTMLElement) {
    return closestHtmlBlockElement;
  }

  if (fallback instanceof HTMLElement) {
    return fallback;
  }

  return targetElement instanceof HTMLElement ? targetElement : null;
}

export function getHtmlBlockAnchorViewportPosition(anchorElement: HTMLElement | null) {
  if (!anchorElement) {
    return {
      x: themeDomStyleTokens.editorPopupFallbackX,
      y: themeDomStyleTokens.editorPopupFallbackY,
    };
  }

  const rect = anchorElement.getBoundingClientRect();
  return {
    x: rect.left,
    y: rect.bottom + themeDomStyleTokens.editorPopupAnchorOffsetPx,
  };
}

export function isHtmlBlockScrollbarPointerDown(args: {
  event: MouseEvent;
  htmlBlockElement: HTMLElement;
}) {
  const { event, htmlBlockElement } = args;
  if (typeof window === 'undefined') {
    return false;
  }

  const overflowX = window.getComputedStyle(htmlBlockElement).overflowX;
  const scrollbarHeight = htmlBlockElement.offsetHeight - htmlBlockElement.clientHeight;
  const hasHorizontalScrollbar =
    (overflowX === 'auto' || overflowX === 'scroll') &&
    htmlBlockElement.scrollWidth > htmlBlockElement.clientWidth &&
    scrollbarHeight > 0;

  if (!hasHorizontalScrollbar) {
    return false;
  }

  const rect = htmlBlockElement.getBoundingClientRect();
  return (
    event.clientX >= rect.left &&
    event.clientX <= rect.right &&
    event.clientY >= rect.bottom - scrollbarHeight &&
    event.clientY <= rect.bottom
  );
}

function resolveHtmlBlockEditorOpenState(args: {
  view: HtmlBlockEditorViewLike;
  pos: number;
  getPosition: (nodePos: number) => { x: number; y: number };
}): HtmlBlockEditorState | null {
  const { view, pos, getPosition } = args;
  const $pos = view.state.doc.resolve(pos);
  const node = view.state.doc.nodeAt(pos);

  if (node?.type.name === 'html_block' && isEditableHtmlBlockValue(node.attrs.value)) {
    return createOpenHtmlBlockEditorState({
      value: node.attrs.value,
      position: getPosition(pos),
      nodePos: pos,
    });
  }

  for (let depth = $pos.depth; depth > 0; depth--) {
    const parentNode = $pos.node(depth);
    if (parentNode.type.name !== 'html_block' || !isEditableHtmlBlockValue(parentNode.attrs.value)) {
      continue;
    }

    const parentPos = $pos.before(depth);
    return createOpenHtmlBlockEditorState({
      value: parentNode.attrs.value,
      position: getPosition(parentPos),
      nodePos: parentPos,
    });
  }

  return null;
}

function resolveHtmlBlockEditorOpenMeta(args: {
  view: HtmlBlockEditorViewLike;
  pos: number;
  target: EventTarget | null;
}) {
  const { view, pos, target } = args;
  return resolveHtmlBlockEditorOpenState({
    view,
    pos,
    getPosition(nodePos) {
      return getHtmlBlockAnchorViewportPosition(
        resolveHtmlBlockAnchorElement(
          target,
          typeof view.nodeDOM === 'function' ? view.nodeDOM(nodePos) : null
        )
      );
    },
  });
}

export function resolveHtmlBlockEditorPointerOpen(args: {
  view: HtmlBlockEditorViewLike;
  target: EventTarget | null;
}) {
  const { view, target } = args;
  const htmlBlockElement = findHtmlBlockEditorTargetElement(view, target);
  if (!htmlBlockElement) {
    return null;
  }

  try {
    const meta = resolveHtmlBlockEditorOpenMeta({
      view,
      pos: view.posAtDOM(htmlBlockElement, 0),
      target,
    });

    if (!meta) {
      return null;
    }

    return { htmlBlockElement, meta };
  } catch {
    return null;
  }
}
