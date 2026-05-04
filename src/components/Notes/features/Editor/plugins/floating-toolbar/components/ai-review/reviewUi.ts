import type { EditorView } from '@milkdown/kit/prose/view';
import type { FloatingToolbarState } from '../../types';
import { clearResultSurfacePredictedHeight, renderResultSurfaceAppliedPreview } from './resultSurface';
import { toAiSelectionSuggestion } from './reviewState';

export function stopReviewMouseDown(event: MouseEvent) {
  event.preventDefault();
  event.stopPropagation();
}

export function stopPassiveReviewMouseDown(event: MouseEvent) {
  const target = event.target;
  if (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  ) {
    event.stopPropagation();
    return;
  }

  if (target instanceof HTMLElement && target.closest('.ai-review-result-surface')) {
    event.stopPropagation();
    return;
  }

  stopReviewMouseDown(event);
}

export function syncReviewUi(
  panel: HTMLElement,
  review: NonNullable<FloatingToolbarState['aiReview']>,
  acceptButton: HTMLButtonElement,
  view: EditorView
) {
  if (!review.isLoading) {
    acceptButton.disabled = review.suggestedText.trim().length === 0;
  }

  const resultSurface = panel.querySelector<HTMLElement>('.ai-review-result-surface');
  if (!resultSurface) {
    return;
  }

  const suggestion = toAiSelectionSuggestion(review);
  if (!suggestion) {
    clearResultSurfacePredictedHeight(resultSurface);
    resultSurface.replaceChildren();
    return;
  }

  renderResultSurfaceAppliedPreview(resultSurface, view, suggestion);
}
