import type { EditorState } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import type { BlockRect } from './blockSelectionUtils';
import { resolveTopLevelBlockElement } from './topLevelBlockDom';

interface BlockRectResolverOptions {
  view: EditorView;
  scrollRootSelector: string;
}

export interface BlockRectResolver {
  getTopLevelBlockRects: () => BlockRect[];
  invalidate: () => void;
}

function collectTopLevelBlockRects(view: EditorView): BlockRect[] {
  const blocks: BlockRect[] = [];
  view.state.doc.forEach((_node, offset) => {
    const from = offset;
    const to = offset + _node.nodeSize;
    const element = resolveTopLevelBlockElement(view, from);
    if (!element) return;

    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    blocks.push({
      from,
      to,
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
    });
  });
  return blocks;
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
      if (cachedDoc === view.state.doc && cachedScrollLeft === left && cachedScrollTop === top) {
        return cachedRects;
      }

      cachedDoc = view.state.doc;
      cachedScrollLeft = left;
      cachedScrollTop = top;
      cachedRects = collectTopLevelBlockRects(view);
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
