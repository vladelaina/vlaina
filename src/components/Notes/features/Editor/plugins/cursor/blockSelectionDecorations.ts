import type { EditorState } from '@milkdown/kit/prose/state';
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view';
import { LARGE_BLOCK_SELECTION_RENDERING_THRESHOLD, type BlockRange } from './blockSelectionTypes';
import {
  getBlockRangeKey,
  getDisplayBlockRangesForDecorations,
} from './blockSelectionRanges';
import {
  LARGE_RICH_BLOCK_SELECTION_DECORATION_CLASS,
  LARGE_TEXTLIKE_BLOCK_SELECTION_DECORATION_CLASS,
  getBlockSelectionDecorationClass,
  getBlockSelectionStructuralClass,
  isNodeDecorationRange,
  isTextLikeDecorationRange,
  resolveParentMarkerDecorationRanges,
  trimTrailingHardBreakFromInlineRange,
  type BlockSelectionDecorationContext,
} from './blockSelectionDecorationClasses';
import {
  areBlockSelectionDisplayRangesVisuallyAdjacent,
  isPartialParagraphRange,
} from './blockSelectionDecorationAdjacency';

export { areBlockSelectionDisplayRangesVisuallyAdjacent } from './blockSelectionDecorationAdjacency';
export { getBlockSelectionDecorationClass } from './blockSelectionDecorationClasses';

export function createBlockSelectionDecorations(doc: EditorState['doc'], blocks: readonly BlockRange[]): DecorationSet {
  if (blocks.length === 0) return DecorationSet.empty;

  const displayRanges = getDisplayBlockRangesForDecorations(doc, blocks);
  const useLargeSelectionRendering = displayRanges.length >= LARGE_BLOCK_SELECTION_RENDERING_THRESHOLD;
  const displayRangeKeys = new Set(displayRanges.map((range) => getBlockRangeKey(range.from, range.to)));
  const hasNextDisplayRangeKeys = new Set<string>();
  const hasPreviousDisplayRangeKeys = new Set<string>();
  for (let index = 0; index < displayRanges.length - 1; index += 1) {
    const current = displayRanges[index];
    const next = displayRanges[index + 1];
    if (!current || !next || !areBlockSelectionDisplayRangesVisuallyAdjacent(doc, current, next)) continue;
    hasNextDisplayRangeKeys.add(getBlockRangeKey(current.from, current.to));
    hasPreviousDisplayRangeKeys.add(getBlockRangeKey(next.from, next.to));
  }
  const context: BlockSelectionDecorationContext = {
    displayRangeKeys,
    hasNextDisplayRangeKeys,
    hasPreviousDisplayRangeKeys,
  };
  const parentMarkerDecorations = new Map<string, Decoration>();

  const addParentMarkerDecorations = (range: BlockRange) => {
    if (useLargeSelectionRendering) return;
    for (const parentRange of resolveParentMarkerDecorationRanges(doc, range, displayRangeKeys)) {
      parentMarkerDecorations.set(
        getBlockRangeKey(parentRange.from, parentRange.to),
        Decoration.node(parentRange.from, parentRange.to, { class: 'editor-block-selected-parent-marker' }),
      );
    }
  };

  const decorations = displayRanges.flatMap((range) => {
    const isNodeRange = isNodeDecorationRange(doc, range);
    const isInlineLineSelection = !isNodeRange && isPartialParagraphRange(doc, range);
    if (useLargeSelectionRendering) {
      const rangeKey = getBlockRangeKey(range.from, range.to);
      const structuralClass = getBlockSelectionStructuralClass(doc, range, isNodeRange);
      const className = [
        isTextLikeDecorationRange(doc, range, isNodeRange)
          ? LARGE_TEXTLIKE_BLOCK_SELECTION_DECORATION_CLASS
          : LARGE_RICH_BLOCK_SELECTION_DECORATION_CLASS,
        structuralClass,
        context.hasNextDisplayRangeKeys.has(rangeKey) ? 'editor-block-selected-has-next' : '',
        context.hasPreviousDisplayRangeKeys.has(rangeKey) ? 'editor-block-selected-has-previous' : '',
        isInlineLineSelection ? 'editor-block-selected-inline-line' : '',
      ].filter(Boolean).join(' ');
      if (isNodeRange) {
        return [Decoration.node(range.from, range.to, { class: className })];
      }
      const inlineRange = trimTrailingHardBreakFromInlineRange(doc, range);
      return inlineRange ? [Decoration.inline(inlineRange.from, inlineRange.to, {
        class: className,
      })] : [];
    }

    const rangeKey = getBlockRangeKey(range.from, range.to);
    const isTextLikeSelection = isTextLikeDecorationRange(doc, range, isNodeRange);
    const structuralClass = getBlockSelectionStructuralClass(doc, range, isNodeRange);
    const attrs = {
      class: [
        getBlockSelectionDecorationClass(doc, range, displayRanges, context),
        isTextLikeSelection ? 'editor-block-selected-textlike' : '',
        structuralClass,
        context.hasNextDisplayRangeKeys.has(rangeKey) ? 'editor-block-selected-has-next' : '',
        context.hasPreviousDisplayRangeKeys.has(rangeKey) ? 'editor-block-selected-has-previous' : '',
        isInlineLineSelection ? 'editor-block-selected-inline-line' : '',
      ].filter(Boolean).join(' '),
    };
    if (isNodeRange) {
      addParentMarkerDecorations(range);
      return [Decoration.node(range.from, range.to, attrs)];
    }

    const inlineRange = trimTrailingHardBreakFromInlineRange(doc, range);
    if (!inlineRange) return [];

    addParentMarkerDecorations(range);
    return [Decoration.inline(inlineRange.from, inlineRange.to, attrs)];
  });

  return DecorationSet.create(doc, [
    ...decorations,
    ...parentMarkerDecorations.values(),
  ]);
}
