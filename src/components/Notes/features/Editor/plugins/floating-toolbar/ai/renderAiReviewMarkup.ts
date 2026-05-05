import type { FloatingToolbarState } from '../types';
import { EDITOR_ICONS } from '@/components/ui/icons/editor-svgs';
import { renderAiReviewDiffMarkup } from './reviewDiff';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderAiReviewMarkup(state: FloatingToolbarState): string | null {
  if (state.subMenu !== 'aiReview' || !state.aiReview) {
    return null;
  }

  const review = state.aiReview;
  const showRetryAction = !review.isLoading && (!!review.errorMessage || review.suggestedText.trim().length > 0);
  const canRenderDiff = Boolean(review.instruction) && review.suggestedText.trim().length > 0;
  const resultMarkup = review.isLoading
    ? '<div class="ai-review-loading-slot"></div>'
    : review.errorMessage
      ? `<div class="ai-review-error" role="alert">${escapeHtml(review.errorMessage)}</div>`
    : canRenderDiff
      ? `
      <div class="ai-review-result-surface">${renderAiReviewDiffMarkup(review.originalText, review.suggestedText)}</div>
    `
      : '<div class="ai-review-result-surface"></div>';

  return `
    <div class="floating-toolbar-inner floating-toolbar-ai-review-mode">
      <div class="ai-review-panel" tabindex="-1">
        <div class="ai-review-body">
          <section class="ai-review-merge-panel">
            <div class="ai-review-content ai-review-content-after ai-review-content-glass">
              ${resultMarkup}
              <div class="ai-review-footer">
                <div class="ai-review-controls-left">
                  <div class="ai-review-model-selector-slot"></div>
                  ${showRetryAction ? `<button class="ai-review-action tertiary ai-review-icon-action vlaina-icon-shadow-button" type="button" data-review-action="retry" aria-label="Retry">${EDITOR_ICONS.reviewRetry}</button>` : ''}
                </div>
                <div class="ai-review-controls-right">
                  <button class="ai-review-action tertiary ai-review-icon-action vlaina-icon-shadow-button" type="button" data-review-action="cancel" aria-label="Cancel">${EDITOR_ICONS.reviewClose}</button>
                  <button class="ai-review-action primary ai-review-icon-action vlaina-icon-shadow-button" type="button" data-review-action="accept" aria-label="Apply" ${review.isLoading || !review.suggestedText ? 'disabled' : ''}>${EDITOR_ICONS.reviewApply}</button>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  `;
}
