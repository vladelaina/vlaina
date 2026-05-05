import { TOOLBAR_ACTIONS, type FloatingToolbarState, type ToolbarMeta } from './types';

interface PositionMapping {
  map: (pos: number, assoc?: number) => number;
}

export function createInitialState(): FloatingToolbarState {
  return {
    isVisible: false,
    position: { x: 0, y: 0 },
    placement: 'top',
    dragPosition: null,
    activeMarks: new Set(),
    currentBlockType: 'paragraph',
    currentAlignment: 'left',
    copied: false,
    linkUrl: null,
    textColor: null,
    bgColor: null,
    subMenu: null,
    aiReview: null,
    aiReviews: [],
  };
}

function upsertAiReview(
  reviews: FloatingToolbarState['aiReviews'],
  review: FloatingToolbarState['aiReview']
): FloatingToolbarState['aiReviews'] {
  if (!review) {
    return reviews;
  }

  const index = reviews.findIndex((item) => item.requestKey === review.requestKey);
  if (index === -1) {
    return [...reviews, review];
  }

  return reviews.map((item, itemIndex) => itemIndex === index ? review : item);
}

function getExistingAiReview(
  state: FloatingToolbarState,
  requestKey: string
): FloatingToolbarState['aiReview'] {
  return state.aiReviews.find((item) => item.requestKey === requestKey)
    ?? (state.aiReview?.requestKey === requestKey ? state.aiReview : null)
    ?? null;
}

function preserveMappedReviewRange(
  state: FloatingToolbarState,
  review: FloatingToolbarState['aiReview']
): FloatingToolbarState['aiReview'] {
  if (!review) {
    return null;
  }

  const existing = getExistingAiReview(state, review.requestKey);
  if (!existing) {
    return review;
  }

  return {
    ...review,
    from: existing.from,
    to: existing.to,
    originalText: existing.originalText,
    beforeContext: existing.beforeContext,
    afterContext: existing.afterContext,
  };
}

export function applyToolbarMeta(
  prevState: FloatingToolbarState,
  meta: ToolbarMeta | undefined
): FloatingToolbarState | null {
  if (!meta) {
    return null;
  }

  switch (meta.type) {
    case TOOLBAR_ACTIONS.SHOW:
      return { ...prevState, isVisible: true, ...meta.payload };
    case TOOLBAR_ACTIONS.HIDE:
      if (prevState.aiReviews.length > 0) {
        const aiReview = prevState.aiReview ?? prevState.aiReviews[prevState.aiReviews.length - 1] ?? null;
        return {
          ...prevState,
          isVisible: true,
          subMenu: aiReview ? 'aiReview' : null,
          copied: false,
          aiReview,
          dragPosition: aiReview ? prevState.dragPosition : null,
        };
      }

      return {
        ...prevState,
        isVisible: false,
        subMenu: null,
        copied: false,
        aiReview: null,
        aiReviews: [],
        dragPosition: null,
      };
    case TOOLBAR_ACTIONS.UPDATE_POSITION:
      return { ...prevState, ...meta.payload };
    case TOOLBAR_ACTIONS.SET_SUB_MENU:
      return { ...prevState, subMenu: meta.payload?.subMenu ?? null };
    case TOOLBAR_ACTIONS.SET_COPIED:
      return { ...prevState, copied: meta.payload?.copied ?? false };
    case TOOLBAR_ACTIONS.SET_AI_REVIEW: {
      const aiReview = preserveMappedReviewRange(prevState, meta.payload?.aiReview ?? null);
      return {
        ...prevState,
        isVisible: true,
        subMenu: 'aiReview',
        dragPosition: meta.payload?.dragPosition ?? prevState.dragPosition,
        aiReview,
        aiReviews: upsertAiReview(prevState.aiReviews, aiReview),
      };
    }
    case TOOLBAR_ACTIONS.CLOSE_AI_REVIEW: {
      const requestKey = meta.payload?.requestKey;
      if (!requestKey) {
        return prevState;
      }

      const aiReviews = prevState.aiReviews.filter((review) => review.requestKey !== requestKey);
      const aiReview = prevState.aiReview?.requestKey === requestKey
        ? (aiReviews[aiReviews.length - 1] ?? null)
        : prevState.aiReview;
      return {
        ...prevState,
        aiReviews,
        aiReview,
        subMenu: aiReview ? 'aiReview' : null,
        isVisible: aiReview ? prevState.isVisible : false,
        dragPosition: aiReview ? prevState.dragPosition : null,
      };
    }
    default:
      return { ...prevState, ...meta.payload };
  }
}

function mapOneAiReviewRange(
  review: NonNullable<FloatingToolbarState['aiReview']>,
  mapping: PositionMapping,
  docSize: number
): NonNullable<FloatingToolbarState['aiReview']> {
  const from = Math.max(0, Math.min(mapping.map(review.from, 1), docSize));
  const to = Math.max(from, Math.min(mapping.map(review.to, -1), docSize));
  if (from === review.from && to === review.to) {
    return review;
  }

  return {
    ...review,
    from,
    to,
  };
}

export function mapAiReviewRange(
  state: FloatingToolbarState,
  mapping: PositionMapping,
  docSize: number
): FloatingToolbarState {
  if (state.subMenu !== 'aiReview' || !state.aiReview) {
    if (state.aiReviews.length === 0) {
      return state;
    }

    return {
      ...state,
      aiReviews: state.aiReviews.map((review) => mapOneAiReviewRange(review, mapping, docSize)),
    };
  }

  const aiReviews = state.aiReviews.map((review) => mapOneAiReviewRange(review, mapping, docSize));
  const aiReview = aiReviews.find((review) => review.requestKey === state.aiReview?.requestKey)
    ?? mapOneAiReviewRange(state.aiReview, mapping, docSize);

  return {
    ...state,
    aiReview,
    aiReviews,
  };
}
