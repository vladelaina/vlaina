import type { FloatingToolbarState } from '../types';
import { renderAiReviewDiffMarkup } from './reviewDiff';

export function renderAiReviewMarkup(state: FloatingToolbarState): string | null {
  if (state.subMenu !== 'aiReview' || !state.aiReview) {
    return null;
  }

  const review = state.aiReview;
  const resultMarkup = review.isLoading
    ? `
      <div class="ai-review-loading">
        <span class="ai-review-loading-line line-1"></span>
        <span class="ai-review-loading-line line-2"></span>
        <span class="ai-review-loading-line line-3"></span>
      </div>
    `
    : `
      <div class="ai-review-result-surface">${renderAiReviewDiffMarkup(review.originalText, review.suggestedText)}</div>
    `;

  return `
    <div class="floating-toolbar-inner floating-toolbar-ai-review-mode">
      <div class="ai-review-panel" tabindex="-1">
        <div class="ai-review-header">
          <div class="ai-review-header-side">
            <div class="ai-review-model-selector-slot"></div>
          </div>
        </div>
        <div class="ai-review-body">
          <section class="ai-review-merge-panel">
            <div class="ai-review-content ai-review-content-after ai-review-content-glass">
              ${resultMarkup}
            </div>
          </section>
        </div>
        <div class="ai-review-actions ai-review-actions-inline">
          <div class="ai-review-footer-note">Preview only changes</div>
          <div class="ai-review-actions-right">
            <button class="ai-review-action tertiary" type="button" data-review-action="cancel">Cancel</button>
            <button class="ai-review-action primary" type="button" data-review-action="accept" ${review.isLoading || !review.suggestedText ? 'disabled' : ''}>Apply</button>
          </div>
        </div>
      </div>
    </div>
  `;
}
