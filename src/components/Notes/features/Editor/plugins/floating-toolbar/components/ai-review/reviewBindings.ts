import type { EditorView } from '@milkdown/kit/prose/view';
import {
  applyAiSelectionSuggestion,
  retryAiSelectionSuggestionResult,
} from '../../ai/selectionCommands';
import { floatingToolbarKey } from '../../floatingToolbarKey';
import { collapseSelectionAfterToolbarApply } from '../../selectionCollapse';
import type { FloatingToolbarState } from '../../types';
import type { AiReviewElements } from './reviewDom';
import { toAiSelectionSuggestion } from './reviewState';
import { stopPassiveReviewMouseDown, stopReviewMouseDown, syncReviewUi } from './reviewUi';

interface BindAiReviewActionsParams {
  elements: AiReviewElements;
  onClose: () => void;
  review: NonNullable<FloatingToolbarState['aiReview']>;
  updateReview: (nextReview: FloatingToolbarState['aiReview']) => void;
  view: EditorView;
}

export type ReviewBindingsCleanup = () => void;

function getAiReviewByRequestKey(
  view: EditorView,
  requestKey: string
): FloatingToolbarState['aiReview'] {
  const toolbarState = floatingToolbarKey.getState(view.state);
  return toolbarState?.aiReviews.find((item) => item.requestKey === requestKey)
    ?? (toolbarState?.aiReview?.requestKey === requestKey ? toolbarState.aiReview : null)
    ?? null;
}

export function bindAiReviewActions({
  elements,
  onClose,
  review,
  updateReview,
  view,
}: BindAiReviewActionsParams): ReviewBindingsCleanup {
  const { panel, acceptButton, retryButton, cancelButton } = elements;
  const abortController = new AbortController();
  const { signal } = abortController;
  let focusFrameId = 0;

  const getLiveReview = (): typeof review => getAiReviewByRequestKey(view, review.requestKey) ?? review;

  const applySuggestion = () => {
    const liveReview = getLiveReview();
    const suggestion = toAiSelectionSuggestion(liveReview);
    if (liveReview.isLoading || !liveReview.suggestedText.trim() || !suggestion) {
      onClose();
      return;
    }

    if (applyAiSelectionSuggestion(view, suggestion)) {
      onClose();
      collapseSelectionAfterToolbarApply(view);
    }
  };

  const handlePanelKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Enter' || event.shiftKey || event.metaKey || event.ctrlKey || event.altKey) {
      return;
    }

    const target = event.target as HTMLElement | null;
    if (
      target instanceof HTMLSelectElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLInputElement ||
      target?.closest('select')
    ) {
      return;
    }

    if (acceptButton.disabled) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    applySuggestion();
  };

  panel.addEventListener('mousedown', stopPassiveReviewMouseDown, { signal });
  acceptButton.addEventListener('mousedown', stopReviewMouseDown, { signal });
  retryButton?.addEventListener('mousedown', stopReviewMouseDown, { signal });
  cancelButton.addEventListener('mousedown', stopReviewMouseDown, { signal });

  panel.addEventListener('keydown', handlePanelKeyDown, { signal });

  acceptButton.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    applySuggestion();
  }, { signal });

  cancelButton.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    onClose();
  }, { signal });

  retryButton?.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (review.isLoading) {
      return;
    }

    const liveReview = getLiveReview();
    const suggestion = toAiSelectionSuggestion(liveReview);
    if (!suggestion) {
      return;
    }

    updateReview({ ...liveReview, isLoading: true, errorMessage: null });
    void retryAiSelectionSuggestionResult(suggestion, undefined, { suppressToast: true }).then((result) => {
      const currentReview = getAiReviewByRequestKey(view, liveReview.requestKey);
      if (!currentReview || currentReview.requestKey !== liveReview.requestKey) {
        return;
      }

      if (!result.suggestion) {
        updateReview({
          ...liveReview,
          suggestedText: '',
          isLoading: false,
          errorMessage: result.errorMessage,
        });
        return;
      }

      updateReview({
        ...result.suggestion,
        requestKey: liveReview.requestKey,
        isLoading: false,
        errorMessage: null,
      });
    }).catch((error: unknown) => {
      if (error instanceof Error && error.name === 'AbortError') return;
      const currentReview = getAiReviewByRequestKey(view, liveReview.requestKey);
      if (!currentReview || currentReview.requestKey !== liveReview.requestKey) return;
      updateReview({
        ...liveReview,
        isLoading: false,
        errorMessage: error instanceof Error ? error.message : 'Retry failed',
      });
    });
  }, { signal });

  syncReviewUi(panel, review, acceptButton, view);
  focusFrameId = requestAnimationFrame(() => {
    focusFrameId = 0;
    if (!panel.isConnected) {
      return;
    }

    const activeElement = document.activeElement;
    if (activeElement instanceof HTMLElement && panel.contains(activeElement)) {
      return;
    }

    if (
      activeElement instanceof HTMLElement &&
      activeElement !== document.body &&
      activeElement.isConnected
    ) {
      return;
    }

    panel.focus({ preventScroll: true });
  });

  return () => {
    if (focusFrameId) {
      cancelAnimationFrame(focusFrameId);
    }
    abortController.abort();
  };
}
