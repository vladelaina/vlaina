import type { FloatingToolbarState } from '../types';
import {
  AI_REVIEW_ACTION_COMMANDS,
  AI_REVIEW_TONE_COMMANDS,
  AI_REVIEW_TRANSLATE_COMMANDS,
} from './constants';
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
  const originalText = escapeHtml(review.originalText);
  const retryLabel = review.isLoading ? 'Generating...' : 'Retry';
  const translateButtons = AI_REVIEW_TRANSLATE_COMMANDS.map((command) => `
    <button
      class="ai-review-command ${review.commandId === command.id ? 'is-active' : ''}"
      type="button"
      data-review-command-id="${command.id}"
    >
      ${command.label}
    </button>
  `).join('');
  const commandButtons = AI_REVIEW_ACTION_COMMANDS.map((command) => `
    <button
      class="ai-review-command ${review.commandId === command.id ? 'is-active' : ''}"
      type="button"
      data-review-command-id="${command.id}"
    >
      ${command.label}
    </button>
  `).join('');
  const toneButtons = AI_REVIEW_TONE_COMMANDS.map((tone) => `
    <button
      class="ai-review-tone ${review.toneId === tone.id ? 'is-active' : ''}"
      type="button"
      data-review-tone-id="${tone.id}"
    >
      ${tone.label}
    </button>
  `).join('');
  const resultMarkup = review.isLoading
    ? `
      <div class="ai-review-loading">
        <span class="ai-review-loading-line line-1"></span>
        <span class="ai-review-loading-line line-2"></span>
        <span class="ai-review-loading-line line-3"></span>
      </div>
    `
    : `<div class="ai-review-result-text">${renderAiReviewDiffMarkup(review.originalText, review.suggestedText)}</div>`;

  return `
    <div class="floating-toolbar-inner floating-toolbar-ai-review-mode">
      <div class="ai-review-panel">
        <div class="ai-review-header" data-review-drag-handle="true">
          <div class="ai-review-header-meta">
            <span class="ai-review-badge">AI Review</span>
            <div class="ai-review-title">Review the suggestion before applying it</div>
          </div>
          <div class="ai-review-header-side">
            <div class="ai-review-model-selector-slot"></div>
            <button class="ai-review-close" type="button" aria-label="Close review" data-review-action="close">×</button>
          </div>
        </div>
        <div class="ai-review-prompt-row">
          <input
            class="ai-review-prompt-input"
            type="text"
            value="${escapeHtml(review.customPrompt)}"
            placeholder="Describe how to rewrite the selected text"
            data-review-prompt-input="true"
          />
          <button
            class="ai-review-prompt-submit"
            type="button"
            data-review-action="prompt-submit"
            ${review.isLoading || review.customPrompt.trim().length === 0 ? 'disabled' : ''}
          >
            Apply
          </button>
        </div>
        <div class="ai-review-control-groups">
          <div class="ai-review-control-group">
            <div class="ai-review-control-label">Translate</div>
            <div class="ai-review-command-row">${translateButtons}</div>
          </div>
          <div class="ai-review-control-group">
            <div class="ai-review-control-label">Actions</div>
            <div class="ai-review-command-row">${commandButtons}</div>
          </div>
          <div class="ai-review-control-group">
            <div class="ai-review-control-label">Tone</div>
            <div class="ai-review-tone-row">${toneButtons}</div>
          </div>
        </div>
        <div class="ai-review-sections ai-review-sections-spotlight">
          <section class="ai-review-section ai-review-section-before">
            <div class="ai-review-section-label">Selected text</div>
            <div class="ai-review-content ai-review-content-before">${originalText}</div>
          </section>
          <section class="ai-review-section ai-review-section-after">
            <div class="ai-review-section-label">Proposed changes</div>
            <div class="ai-review-content ai-review-content-after">${resultMarkup}</div>
          </section>
        </div>
        <div class="ai-review-actions">
          <button class="ai-review-action secondary" type="button" data-review-action="cancel">Cancel</button>
          <button class="ai-review-action secondary" type="button" data-review-action="retry" ${review.isLoading || !review.instruction ? 'disabled' : ''}>${retryLabel}</button>
          <button class="ai-review-action primary" type="button" data-review-action="accept" ${review.isLoading || !review.suggestedText ? 'disabled' : ''}>Accept</button>
        </div>
      </div>
    </div>
  `;
}
