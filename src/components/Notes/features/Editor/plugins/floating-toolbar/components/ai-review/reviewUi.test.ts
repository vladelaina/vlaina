import { describe, expect, it } from 'vitest';
import { syncReviewUi } from './reviewUi';
import type { FloatingToolbarState } from '../../types';

function createReview(overrides: Partial<NonNullable<FloatingToolbarState['aiReview']>> = {}) {
  return {
    requestKey: 'review-1',
    instruction: 'Rewrite',
    commandId: 'rewrite',
    toneId: null,
    from: 1,
    to: 4,
    originalText: 'old',
    suggestedText: 'new',
    isLoading: false,
    errorMessage: null,
    ...overrides,
  } satisfies NonNullable<FloatingToolbarState['aiReview']>;
}

describe('AI review UI sync', () => {
  it('clears reserved result height when there is no renderable suggestion', () => {
    const panel = document.createElement('div');
    const resultSurface = document.createElement('div');
    resultSurface.className = 'ai-review-result-surface';
    resultSurface.appendChild(document.createElement('p'));
    panel.appendChild(resultSurface);
    const acceptButton = document.createElement('button');

    syncReviewUi(panel, createReview({ instruction: null }), acceptButton, { dom: document.createElement('div') } as never);

    expect(resultSurface.childElementCount).toBe(0);
  });

  it('keeps rendered diff markup for a renderable suggestion', () => {
    const panel = document.createElement('div');
    const resultSurface = document.createElement('div');
    resultSurface.className = 'ai-review-result-surface';
    resultSurface.innerHTML = '<ins class="ai-review-diff-added">new</ins>';
    panel.appendChild(resultSurface);
    const acceptButton = document.createElement('button');

    syncReviewUi(panel, createReview(), acceptButton, { dom: document.createElement('div') } as never);

    expect(resultSurface.querySelector('.ai-review-diff-added')?.textContent).toBe('new');
  });

  it('keeps the accept button clickable before a suggestion is rendered', () => {
    const panel = document.createElement('div');
    const resultSurface = document.createElement('div');
    resultSurface.className = 'ai-review-result-surface';
    panel.appendChild(resultSurface);
    const acceptButton = document.createElement('button');
    acceptButton.disabled = false;

    syncReviewUi(
      panel,
      createReview({ suggestedText: '', isLoading: true }),
      acceptButton,
      { dom: document.createElement('div') } as never
    );

    expect(acceptButton.disabled).toBe(false);
  });
});
