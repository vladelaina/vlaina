import type { EditorState } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import type { BlockRect } from './blockSelectionUtils';
import type { BlockRange } from './blockSelectionUtils';
import { resolveBlockElementAtPos } from './topLevelBlockDom';

interface BlockRectResolverOptions {
  view: EditorView;
  scrollRootSelector: string;
}

export interface BlockRectResolver {
  getTopLevelBlockRects: () => BlockRect[];
  invalidate: () => void;
}

function isListContainerNode(name: string): boolean {
  return name === 'bullet_list' || name === 'ordered_list';
}

export function collectSelectableBlockRanges(doc: EditorState['doc']): BlockRange[] {
  const ranges: BlockRange[] = [];
  doc.forEach((node, offset) => {
    if (isListContainerNode(node.type.name)) {
      node.forEach((child, childOffset) => {
        if (child.type.name !== 'list_item') return;
        const from = offset + 1 + childOffset;
        ranges.push({
          from,
          to: from + child.nodeSize,
        });
      });
      return;
    }

    ranges.push({
      from: offset,
      to: offset + node.nodeSize,
    });
  });
  return ranges;
}

function collectSelectableBlockRects(view: EditorView): BlockRect[] {
  const blocks: BlockRect[] = [];
  const ranges = collectSelectableBlockRanges(view.state.doc);
  for (const range of ranges) {
    const element = resolveBlockElementAtPos(view, range.from);
    if (!element) continue;

    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) continue;

    blocks.push({
      from: range.from,
      to: range.to,
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
    });
  }
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
