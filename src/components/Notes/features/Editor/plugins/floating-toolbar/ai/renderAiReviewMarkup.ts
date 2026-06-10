import type { FloatingToolbarState } from '../types';
import { EDITOR_ICONS } from '@/components/ui/icons/editor-svgs';
import { renderAiReviewDiffMarkup } from './reviewDiff';
import { chatComposerGhostIconButtonClass, chatComposerPillSurfaceClass } from '@/components/Chat/features/Input/composerStyles';
import { translate } from '@/lib/i18n';
import { escapeToolbarHtml } from '../htmlEscape';

const reviewIconActionClass = [
  'ai-review-icon-action app-no-drag group flex h-8 w-8 cursor-pointer items-center justify-center',
  'text-[var(--vlaina-sidebar-chat-text)]',
  chatComposerGhostIconButtonClass,
].join(' ');

export function renderAiReviewMarkup(state: FloatingToolbarState): string | null {
  if (state.subMenu !== 'aiReview' || !state.aiReview) {
    return null;
  }

  const review = state.aiReview;
  const retryLabel = escapeToolbarHtml(translate('common.retry'));
  const cancelLabel = escapeToolbarHtml(translate('common.cancel'));
  const applyLabel = escapeToolbarHtml(translate('common.apply'));
  const showRetryAction = !review.isLoading && (!!review.errorMessage || review.suggestedText.trim().length > 0);
  const canRenderDiff = Boolean(review.instruction) && review.suggestedText.trim().length > 0;
  const resultMarkup = review.isLoading
    ? '<div class="ai-review-loading-slot"></div>'
    : review.errorMessage
      ? '<div class="ai-review-error-slot"></div>'
    : canRenderDiff
      ? `
      <div class="ai-review-result-surface">${renderAiReviewDiffMarkup(review.originalText, review.suggestedText)}</div>
    `
      : '<div class="ai-review-result-surface"></div>';

  return `
    <div class="floating-toolbar-inner floating-toolbar-ai-review-mode !rounded-[var(--vlaina-radius-26px)] ${chatComposerPillSurfaceClass}">
      <div class="ai-review-panel" tabindex="-1">
        <div class="ai-review-body">
          <section class="ai-review-merge-panel">
            <div class="ai-review-content ai-review-content-after ai-review-content-glass !rounded-[var(--vlaina-radius-26px)] ${chatComposerPillSurfaceClass}">
              ${resultMarkup}
              <div class="ai-review-footer">
                <div class="ai-review-controls-left">
                  <div class="ai-review-model-selector-slot"></div>
                  ${showRetryAction ? `<button class="${reviewIconActionClass}" type="button" data-review-action="retry" aria-label="${retryLabel}">${EDITOR_ICONS.reviewRetry}</button>` : ''}
                </div>
                <div class="ai-review-controls-right">
                  <button class="${reviewIconActionClass}" type="button" data-review-action="cancel" aria-label="${cancelLabel}">${EDITOR_ICONS.reviewClose}</button>
                  <button class="${reviewIconActionClass}" type="button" data-review-action="accept" aria-label="${applyLabel}">${EDITOR_ICONS.reviewApply}</button>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  `;
}
