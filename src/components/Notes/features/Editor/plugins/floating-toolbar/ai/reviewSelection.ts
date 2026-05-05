import { TextSelection } from '@milkdown/kit/prose/state';
import type { EditorState } from '@milkdown/kit/prose/state';
import type { EditorView } from '@milkdown/kit/prose/view';
import { Decoration, DecorationSet } from '@milkdown/kit/prose/view';
import { TEXT_SELECTION_OVERLAY_CLASS } from '../../selection/textSelectionOverlayPlugin';
import { floatingToolbarKey } from '../floatingToolbarKey';

function isInlineRangeSelection(selection: EditorView['state']['selection'], from: number, to: number) {
  return (
    !selection.empty &&
    selection.from === from &&
    selection.to === to &&
    selection.$from.parent.inlineContent &&
    selection.$to.parent.inlineContent
  );
}

export function ensureReviewSelectionVisible(view: EditorView, from: number, to: number) {
  const maxPos = view.state.doc.content.size;
  const nextFrom = Math.max(0, Math.min(from, maxPos));
  const nextTo = Math.max(nextFrom, Math.min(to, maxPos));
  if (nextFrom === nextTo) {
    return;
  }

  const hasMatchingSelection = isInlineRangeSelection(view.state.selection, nextFrom, nextTo);

  if (!view.hasFocus()) {
    view.focus();
  }

  if (hasMatchingSelection) {
    return;
  }

  view.dispatch(
    view.state.tr
      .setSelection(TextSelection.create(view.state.doc, nextFrom, nextTo))
      .setMeta('addToHistory', false)
  );
}

export function getAiReviewSelectionDecorations(state: EditorState): DecorationSet {
  const toolbarState = floatingToolbarKey.getState(state);
  const reviews = toolbarState?.aiReviews?.length
    ? toolbarState.aiReviews
    : toolbarState?.aiReview
      ? [toolbarState.aiReview]
      : [];
  if (reviews.length === 0) {
    return DecorationSet.empty;
  }

  const maxPos = state.doc.content.size;
  const decorations: Decoration[] = [];
  reviews.forEach((review) => {
    const from = Math.max(0, Math.min(review.from, maxPos));
    const to = Math.max(from, Math.min(review.to, maxPos));
    if (from === to) {
      return;
    }

    state.doc.nodesBetween(from, to, (node, pos) => {
      if (!node.isText) return;

      const decorationFrom = Math.max(from, pos);
      const decorationTo = Math.min(to, pos + node.nodeSize);
      if (decorationTo <= decorationFrom) return;

      decorations.push(Decoration.inline(decorationFrom, decorationTo, {
        class: TEXT_SELECTION_OVERLAY_CLASS,
      }));
    });
  });

  return decorations.length > 0
    ? DecorationSet.create(state.doc, decorations)
    : DecorationSet.empty;
}
