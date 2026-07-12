import type { EditorView } from '@milkdown/kit/prose/view';
import { expandKnownSelectableListItemHeaderRanges } from './blockUnitResolver';
import {
  createBlockRectYIndex,
  convertBlockRectsToDocumentSpace,
  convertViewportDragRectToDocumentRect,
  getBlockRangesKey,
  preferNestedBlockRanges,
  preferNestedBlockRangesUnlessHeaderIntersects,
  resolveIntersectedBlockRangesFromYIndex,
  type BlockRect,
  type BlockRectYIndex,
  type BlockRange,
  type RectBounds,
} from './blockSelectionUtils';
import { expandDragRectPointerEdgeY, areRectBoundsEqual } from './blankAreaSelectionDragBox';
import { filterExternalBlankAreaSelectionEdgeGrazes } from './blankAreaSelectionGeometry';

interface BlankAreaSelectionRectResolver {
  getSelectionBlockRects: () => readonly BlockRect[];
  invalidate: () => void;
}

export function createBlankAreaSelectionResolver(args: {
  view: EditorView;
  rectResolver: BlankAreaSelectionRectResolver;
  startClientX: number;
  startClientY: number;
  startScrollLeft: number;
  startScrollTop: number;
  getScrollLeft: () => number;
  getScrollTop: () => number;
  initialSelectedBlocks: readonly BlockRange[];
  shouldFilterExternalEdgeGrazes: boolean;
  onSelectionChange: (blocks: BlockRange[]) => void;
}) {
  let selectedBlocksKey = getBlockRangesKey(args.initialSelectedBlocks);
  let lastAppliedViewportDragRect: RectBounds | null = null;
  let lastAppliedScrollLeft = Number.NaN;
  let lastAppliedScrollTop = Number.NaN;
  let preserveContainingBlocksForSession = false;
  let didResolveFirstNonEmptySelection = false;
  let cachedSelectionResolutionKey = '';
  let cachedSelectionResolutionBlocks: BlockRange[] = [];
  let cachedSelectionResolutionExpandedKey = '';
  let cachedDocSpaceBlockRects: readonly BlockRect[] | null = null;
  let cachedDocSpaceBlockIndex: BlockRectYIndex | null = null;

  const getDocSpaceBlockRectIndex = (
    currentScrollLeft: number,
    currentScrollTop: number,
  ): { blockRects: readonly BlockRect[]; index: BlockRectYIndex } => {
    if (cachedDocSpaceBlockRects && cachedDocSpaceBlockIndex) {
      return {
        blockRects: cachedDocSpaceBlockRects,
        index: cachedDocSpaceBlockIndex,
      };
    }

    const sourceRects = args.rectResolver.getSelectionBlockRects();
    if (sourceRects.length === 0) {
      return {
        blockRects: [],
        index: createBlockRectYIndex([]),
      };
    }

    const docSpaceBlockRects = convertBlockRectsToDocumentSpace(sourceRects, currentScrollLeft, currentScrollTop);
    const docSpaceBlockIndex = createBlockRectYIndex(docSpaceBlockRects);
    cachedDocSpaceBlockRects = docSpaceBlockRects;
    cachedDocSpaceBlockIndex = docSpaceBlockIndex;
    return {
      blockRects: docSpaceBlockRects,
      index: docSpaceBlockIndex,
    };
  };

  const invalidateGeometryCache = () => {
    args.rectResolver.invalidate();
    cachedDocSpaceBlockRects = null;
    cachedDocSpaceBlockIndex = null;
    cachedSelectionResolutionKey = '';
    cachedSelectionResolutionBlocks = [];
    cachedSelectionResolutionExpandedKey = '';
    lastAppliedViewportDragRect = null;
    lastAppliedScrollLeft = Number.NaN;
    lastAppliedScrollTop = Number.NaN;
  };

  const applyDragRectSelection = (viewportDragRect: RectBounds) => {
    const currentScrollLeft = args.getScrollLeft();
    const currentScrollTop = args.getScrollTop();
    lastAppliedViewportDragRect = viewportDragRect;
    lastAppliedScrollLeft = currentScrollLeft;
    lastAppliedScrollTop = currentScrollTop;
    const docSpaceDragRect = convertViewportDragRectToDocumentRect(
      viewportDragRect,
      args.startClientX,
      args.startClientY,
      args.startScrollLeft,
      args.startScrollTop,
      currentScrollLeft,
      currentScrollTop,
    );
    const hitTestDragRect = expandDragRectPointerEdgeY(docSpaceDragRect, args.startClientY + args.startScrollTop);
    const { blockRects: docSpaceBlockRects, index: docSpaceBlockIndex } = getDocSpaceBlockRectIndex(
      currentScrollLeft,
      currentScrollTop,
    );
    const selectedBlocks = args.shouldFilterExternalEdgeGrazes
      ? filterExternalBlankAreaSelectionEdgeGrazes(
        docSpaceBlockRects,
        resolveIntersectedBlockRangesFromYIndex(docSpaceBlockIndex, hitTestDragRect),
        hitTestDragRect,
      )
      : resolveIntersectedBlockRangesFromYIndex(docSpaceBlockIndex, hitTestDragRect);
    const selectedIntersectionKey = getBlockRangesKey(selectedBlocks);
    if (!didResolveFirstNonEmptySelection && selectedBlocks.length > 0) {
      didResolveFirstNonEmptySelection = true;
      preserveContainingBlocksForSession = preferNestedBlockRanges(selectedBlocks).length === selectedBlocks.length;
    }
    const selectionResolutionKey = `${selectedIntersectionKey}|${preserveContainingBlocksForSession ? 'preserve' : 'nested'}|${Math.round(hitTestDragRect.top * 100) / 100}|${currentScrollLeft}|${currentScrollTop}`;
    let expandedBlocks = cachedSelectionResolutionBlocks;
    let nextKey = cachedSelectionResolutionExpandedKey;

    if (selectionResolutionKey !== cachedSelectionResolutionKey) {
      const nestedPreferredBlocks = preserveContainingBlocksForSession
        ? selectedBlocks
        : preferNestedBlockRangesUnlessHeaderIntersects(selectedBlocks, docSpaceBlockRects, hitTestDragRect);
      expandedBlocks = expandKnownSelectableListItemHeaderRanges(
        args.view.state.doc,
        nestedPreferredBlocks,
        docSpaceBlockRects,
      );
      nextKey = getBlockRangesKey(expandedBlocks);
      cachedSelectionResolutionKey = selectionResolutionKey;
      cachedSelectionResolutionBlocks = expandedBlocks;
      cachedSelectionResolutionExpandedKey = nextKey;
    }
    if (nextKey === selectedBlocksKey) return;

    selectedBlocksKey = nextKey;
    args.onSelectionChange(expandedBlocks);
  };

  const applyDragRectSelectionIfNeeded = (viewportDragRect: RectBounds): void => {
    const currentScrollLeft = args.getScrollLeft();
    const currentScrollTop = args.getScrollTop();
    if (
      areRectBoundsEqual(lastAppliedViewportDragRect, viewportDragRect)
      && lastAppliedScrollLeft === currentScrollLeft
      && lastAppliedScrollTop === currentScrollTop
    ) {
      return;
    }

    applyDragRectSelection(viewportDragRect);
  };

  return { applyDragRectSelectionIfNeeded, invalidateGeometryCache };
}
