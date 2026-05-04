import { describe, expect, it, vi } from 'vitest';
import { syncReviewUi } from './reviewUi';
import type { FloatingToolbarState } from '../../types';

const resultSurfaceMocks = vi.hoisted(() => ({
  clearResultSurfacePredictedHeight: vi.fn(),
  renderResultSurfaceAppliedPreview: vi.fn(),
}));

vi.mock('./resultSurface', () => ({
  clearResultSurfacePredictedHeight: resultSurfaceMocks.clearResultSurfacePredictedHeight,
  renderResultSurfaceAppliedPreview: resultSurfaceMocks.renderResultSurfaceAppliedPreview,
}));

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

    expect(resultSurfaceMocks.clearResultSurfacePredictedHeight).toHaveBeenCalledWith(resultSurface);
    expect(resultSurface.childElementCount).toBe(0);
    expect(resultSurfaceMocks.renderResultSurfaceAppliedPreview).not.toHaveBeenCalled();
  });
});
