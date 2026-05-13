import type { FloatingToolbarState } from '../types';
import { EDITOR_ICONS } from '@/components/ui/icons/editor-svgs';
import { renderAiReviewDiffMarkup } from './reviewDiff';
import { chatComposerPillSurfaceClass } from '@/components/Chat/features/Input/composerStyles';
import { translate } from '@/lib/i18n';

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
  const retryLabel = translate('common.retry');
  const cancelLabel = translate('common.cancel');
  const applyLabel = translate('common.apply');
  const showRetryAction = !review.isLoading && (!!review.errorMessage || review.suggestedText.trim().length > 0);
  const canRenderDiff = Boolean(review.instruction) && review.suggestedText.trim().length > 0;
  const showSignInPrompt = review.errorType === 'AUTH_ERROR';
  const resultMarkup = review.isLoading
    ? '<div class="ai-review-loading-slot"></div>'
    : review.errorMessage
      ? showSignInPrompt
        ? '<div class="ai-review-sign-in-slot"></div>'
        : `<div class="ai-review-error" role="alert">${escapeHtml(review.errorMessage)}</div>`
    : canRenderDiff
      ? `
      <div class="ai-review-result-surface">${renderAiReviewDiffMarkup(review.originalText, review.suggestedText)}</div>
    `
      : '<div class="ai-review-result-surface"></div>';

  return `
    <div class="floating-toolbar-inner floating-toolbar-ai-review-mode !rounded-[26px] ${chatComposerPillSurfaceClass}">
      <div class="ai-review-panel" tabindex="-1">
        <div class="ai-review-body">
          <section class="ai-review-merge-panel">
            <div class="ai-review-content ai-review-content-after ai-review-content-glass !rounded-[26px] ${chatComposerPillSurfaceClass}">
              ${resultMarkup}
              <div class="ai-review-footer">
                <div class="ai-review-controls-left">
                  <div class="ai-review-model-selector-slot"></div>
                  ${showRetryAction ? `<button class="ai-review-action tertiary ai-review-icon-action vlaina-icon-shadow-button" type="button" data-review-action="retry" aria-label="${retryLabel}">${EDITOR_ICONS.reviewRetry}</button>` : ''}
                </div>
                <div class="ai-review-controls-right">
                  <button class="ai-review-action tertiary ai-review-icon-action vlaina-icon-shadow-button" type="button" data-review-action="cancel" aria-label="${cancelLabel}">${EDITOR_ICONS.reviewClose}</button>
                  <button class="ai-review-action primary ai-review-icon-action vlaina-icon-shadow-button" type="button" data-review-action="accept" aria-label="${applyLabel}">${EDITOR_ICONS.reviewApply}</button>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  `;
}
