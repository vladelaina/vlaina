import type { EditorState } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import type { BlockRect } from './blockSelectionUtils';
import { collectSelectableBlockTargets } from './blockUnitResolver';

interface BlockRectResolverOptions {
  view: EditorView;
  scrollRootSelector: string;
}

export interface BlockRectResolver {
  getTopLevelBlockRects: () => BlockRect[];
  invalidate: () => void;
}

export { collectSelectableBlockRanges } from './blockUnitResolver';

function isIgnoredContentBoundsElement(element: Element): boolean {
  return element.matches('ul, ol, button, [contenteditable="false"], .vlaina-collapse-btn');
}

function collectTextContentBounds(root: HTMLElement): { left: number; right: number } | null {
  const doc = root.ownerDocument;
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      const ignoredAncestor = parent.closest('ul, ol, button, [contenteditable="false"], .vlaina-collapse-btn');
      if (ignoredAncestor && root.contains(ignoredAncestor)) {
        return NodeFilter.FILTER_REJECT;
      }
      return node.textContent && node.textContent.length > 0
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_REJECT;
    },
  });

  let left = Number.POSITIVE_INFINITY;
  let right = Number.NEGATIVE_INFINITY;
  let hasBounds = false;

  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const range = doc.createRange();
    range.selectNodeContents(node);
    for (const rect of Array.from(range.getClientRects())) {
      if (rect.width <= 0 && rect.height <= 0) continue;
      left = Math.min(left, rect.left);
      right = Math.max(right, rect.right);
      hasBounds = true;
    }
    range.detach();
  }

  return hasBounds ? { left, right } : null;
}

function resolveContentBoundsElement(element: HTMLElement): HTMLElement {
  if (element.tagName !== 'LI') return element;

  for (const child of Array.from(element.children)) {
    if (!(child instanceof HTMLElement)) continue;
    if (isIgnoredContentBoundsElement(child)) continue;
    return child;
  }

  return element;
}

function resolveContentHorizontalBounds(element: HTMLElement, rect: DOMRect): { left: number; right: number } {
  const contentElement = resolveContentBoundsElement(element);
  return collectTextContentBounds(contentElement) ?? {
    left: rect.left,
    right: rect.right,
  };
}

function collectSelectableBlockRects(view: EditorView): BlockRect[] {
  const targets = collectSelectableBlockTargets(view);
  const editorRect = view.dom.getBoundingClientRect();
  const useEditorHorizontalBounds = editorRect.width > 0;

  return targets.map(({ range, element, rect }) => {
    const contentBounds = resolveContentHorizontalBounds(element, rect);
    const blockRect = {
      from: range.from,
      to: range.to,
      left: useEditorHorizontalBounds ? editorRect.left : rect.left,
      top: rect.top,
      right: useEditorHorizontalBounds ? editorRect.right : rect.right,
      bottom: rect.bottom,
      contentLeft: contentBounds.left,
      contentRight: contentBounds.right,
      ...(element.tagName === 'LI' ? { allowInsideTrailingClick: true } : {}),
    };
    return blockRect;
  });
}

function getScrollCoordinates(view: EditorView, scrollRootSelector: string): { left: number; top: number } {
  const scrollRoot = view.dom.closest(scrollRootSelector) as HTMLElement | null;
  if (!scrollRoot) return { left: 0, top: 0 };
  return {
    left: scrollRoot.scrollLeft,
    top: scrollRoot.scrollTop,
  };
}

export function createBlockRectResolver({ view, scrollRootSelector }: BlockRectResolverOptions): BlockRectResolver {
  let cachedDoc: EditorState['doc'] | null = null;
  let cachedScrollLeft = Number.NaN;
  let cachedScrollTop = Number.NaN;
  let cachedRects: BlockRect[] = [];

  return {
    getTopLevelBlockRects() {
      const { left, top } = getScrollCoordinates(view, scrollRootSelector);
      if (
        cachedDoc === view.state.doc
        && cachedScrollLeft === left
        && cachedScrollTop === top
      ) {
        return cachedRects;
      }

      cachedDoc = view.state.doc;
      cachedScrollLeft = left;
      cachedScrollTop = top;
      cachedRects = collectSelectableBlockRects(view);
      return cachedRects;
    },
    invalidate() {
      cachedDoc = null;
      cachedScrollLeft = Number.NaN;
      cachedScrollTop = Number.NaN;
      cachedRects = [];
    },
  };
}
