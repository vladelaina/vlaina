import { describe, expect, it } from 'vitest';
import { applyToolbarMeta, createInitialState, mapAiReviewRange } from './floatingToolbarState';
import { TOOLBAR_ACTIONS, type AiReviewState } from './types';

function createReview(requestKey: string, from: number, to: number): AiReviewState {
  return {
    requestKey,
    instruction: 'Translate',
    commandId: 'translate-en',
    toneId: null,
    from,
    to,
    originalText: 'selected',
    suggestedText: '',
    isLoading: true,
    errorMessage: null,
  };
}

describe('floatingToolbarState', () => {
  it('maps a pinned AI review range through document changes', () => {
    const state = {
      ...createInitialState(),
      isVisible: true,
      subMenu: 'aiReview' as const,
      aiReview: createReview('review-1', 10, 20),
      aiReviews: [createReview('review-1', 10, 20)],
    };

    const mapped = mapAiReviewRange(
      state,
      {
        map: (pos) => pos + 5,
      },
      100
    );

    expect(mapped.aiReview?.from).toBe(15);
    expect(mapped.aiReview?.to).toBe(25);
    expect(mapped.subMenu).toBe('aiReview');
    expect(mapped.isVisible).toBe(true);
  });

  it('keeps multiple AI reviews and closes only the requested one', () => {
    const first = createReview('review-1', 10, 20);
    const second = createReview('review-2', 30, 40);

    const withFirst = applyToolbarMeta(createInitialState(), {
      type: TOOLBAR_ACTIONS.SET_AI_REVIEW,
      payload: { aiReview: first },
    });
    const withSecond = applyToolbarMeta(withFirst!, {
      type: TOOLBAR_ACTIONS.SET_AI_REVIEW,
      payload: { aiReview: second },
    });

    expect(withSecond?.aiReviews.map((review) => review.requestKey)).toEqual(['review-1', 'review-2']);
    expect(withSecond?.aiReview?.requestKey).toBe('review-2');

    const closedSecond = applyToolbarMeta(withSecond!, {
      type: TOOLBAR_ACTIONS.CLOSE_AI_REVIEW,
      payload: { requestKey: 'review-2' },
    });

    expect(closedSecond?.aiReviews.map((review) => review.requestKey)).toEqual(['review-1']);
    expect(closedSecond?.aiReview?.requestKey).toBe('review-1');
    expect(closedSecond?.subMenu).toBe('aiReview');
    expect(closedSecond?.isVisible).toBe(true);
  });

  it('does not clear pinned AI reviews on a generic toolbar hide', () => {
    const review = createReview('review-1', 10, 20);
    const state = {
      ...createInitialState(),
      isVisible: true,
      subMenu: 'aiReview' as const,
      aiReview: review,
      aiReviews: [review],
    };

    const hidden = applyToolbarMeta(state, {
      type: TOOLBAR_ACTIONS.HIDE,
    });

    expect(hidden?.isVisible).toBe(true);
    expect(hidden?.subMenu).toBe('aiReview');
    expect(hidden?.aiReviews.map((item) => item.requestKey)).toEqual(['review-1']);
    expect(hidden?.aiReview?.requestKey).toBe('review-1');
  });
});
