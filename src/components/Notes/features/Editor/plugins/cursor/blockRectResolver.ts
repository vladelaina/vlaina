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

function shouldIgnoreContentBoundsElement(root: HTMLElement, element: Element): boolean {
  for (let current: Element | null = element; current && root.contains(current); current = current.parentElement) {
    if (current.matches('ul, ol, button, .vlaina-collapse-btn')) return true;
    if (current.matches('[contenteditable="false"]') && !current.closest('.footnote-ref')) return true;
  }
  return false;
}

function mergeContentLineRects(rects: DOMRect[]): { left: number; top: number; right: number; bottom: number }[] {
  const lines: { left: number; top: number; right: number; bottom: number }[] = [];

  for (const rect of rects) {
    const centerY = rect.top + rect.height / 2;
    const line = lines.find((candidate) => (
      centerY >= candidate.top - 2 && centerY <= candidate.bottom + 2
    ));
    if (line) {
      line.left = Math.min(line.left, rect.left);
      line.top = Math.min(line.top, rect.top);
      line.right = Math.max(line.right, rect.right);
      line.bottom = Math.max(line.bottom, rect.bottom);
      continue;
    }

    lines.push({
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
    });
  }

  return lines;
}

function collectTextContentBounds(root: HTMLElement): { left: number; right: number; lineRects?: { left: number; top: number; right: number; bottom: number }[] } | null {
  const doc = root.ownerDocument;
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      if (shouldIgnoreContentBoundsElement(root, parent)) {
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
  const rects: DOMRect[] = [];

  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const range = doc.createRange();
    range.selectNodeContents(node);
    for (const rect of Array.from(range.getClientRects())) {
      if (rect.width <= 0 && rect.height <= 0) continue;
      left = Math.min(left, rect.left);
      right = Math.max(right, rect.right);
      rects.push(rect);
      hasBounds = true;
    }
    range.detach();
  }

  if (!hasBounds) return null;

  const lineRects = mergeContentLineRects(rects);
  return {
    left,
    right,
    ...(lineRects.length > 1 ? { lineRects } : {}),
  };
}

function resolveContentBoundsElement(element: HTMLElement): HTMLElement {
  if (element.tagName !== 'LI') return element;

  for (const child of Array.from(element.children)) {
    if (!(child instanceof HTMLElement)) continue;
    if (shouldIgnoreContentBoundsElement(element, child)) continue;
    return child;
  }

  return element;
}

function resolveContentHorizontalBounds(element: HTMLElement, rect: DOMRect): { left: number; right: number; lineRects?: { left: number; top: number; right: number; bottom: number }[] } {
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
      ...(contentBounds.lineRects ? { contentLineRects: contentBounds.lineRects } : {}),
      ...(element.tagName === 'LI' || (element.tagName === 'P' && element.querySelector('.footnote-ref'))
        ? { allowInsideTrailingClick: true }
        : {}),
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
