import type { EditorState } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import type { BlockRect } from './blockSelectionUtils';
import { collectSelectableBlockTargets } from './blockUnitResolver';
import {
  getCachedEditorBlockTargets,
  getCurrentEditorBlockPositionSnapshot,
} from '../../utils/editorBlockPositionCache';

interface BlockRectResolverOptions {
  view: EditorView;
  scrollRootSelector: string;
}

export interface BlockRectResolver {
  getTopLevelBlockRects: () => BlockRect[];
  invalidate: () => void;
}

export { collectSelectableBlockRanges } from './blockUnitResolver';

function collectSelectableBlockRects(view: EditorView): BlockRect[] {
  const cachedTargets = getCachedEditorBlockTargets(view);
  const targets = cachedTargets ?? collectSelectableBlockTargets(view);
  const editorRect = view.dom.getBoundingClientRect();
  const useEditorHorizontalBounds = editorRect.width > 0;

  return targets.map(({ range, rect }) => ({
    from: range.from,
    to: range.to,
    left: useEditorHorizontalBounds ? editorRect.left : rect.left,
    top: rect.top,
    right: useEditorHorizontalBounds ? editorRect.right : rect.right,
    bottom: rect.bottom,
  }));
}

function getScrollCoordinates(view: EditorView, scrollRootSelector: string): { left: number; top: number } {
  const snapshot = getCurrentEditorBlockPositionSnapshot();
  if (
    snapshot?.view === view
    && snapshot.scrollRoot?.matches(scrollRootSelector)
  ) {
    return {
      left: snapshot.scrollLeft,
      top: snapshot.scrollTop,
    };
  }

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
  let cachedSnapshotVersion = -1;
  let cachedRects: BlockRect[] = [];

  return {
    getTopLevelBlockRects() {
      const { left, top } = getScrollCoordinates(view, scrollRootSelector);
      const snapshot = getCurrentEditorBlockPositionSnapshot();
      const snapshotVersion = snapshot?.view === view ? snapshot.version : -1;
      if (
        cachedDoc === view.state.doc
        && cachedScrollLeft === left
        && cachedScrollTop === top
        && cachedSnapshotVersion === snapshotVersion
      ) {
        return cachedRects;
      }

      cachedDoc = view.state.doc;
      cachedScrollLeft = left;
      cachedScrollTop = top;
      cachedSnapshotVersion = snapshotVersion;
      cachedRects = collectSelectableBlockRects(view);
      return cachedRects;
    },
    invalidate() {
      cachedDoc = null;
      cachedScrollLeft = Number.NaN;
      cachedScrollTop = Number.NaN;
      cachedSnapshotVersion = -1;
      cachedRects = [];
    },
  };
}
