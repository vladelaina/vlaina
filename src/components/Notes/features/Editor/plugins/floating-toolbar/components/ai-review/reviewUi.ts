import type { FloatingToolbarState } from '../../types';
import { renderResultSurfacePreview } from './resultSurface';

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

  stopReviewMouseDown(event);
}

export function syncReviewUi(
  panel: HTMLElement,
  review: NonNullable<FloatingToolbarState['aiReview']>,
  acceptButton: HTMLButtonElement
) {
  if (!review.isLoading) {
    acceptButton.disabled = review.suggestedText.trim().length === 0;
  }

  const resultSurface = panel.querySelector<HTMLElement>('.ai-review-result-surface');
  if (!resultSurface) {
    return;
  }

  renderResultSurfacePreview(resultSurface, review.originalText, review.suggestedText);
}
