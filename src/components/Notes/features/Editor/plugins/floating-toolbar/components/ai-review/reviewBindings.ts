import type { EditorView } from '@milkdown/kit/prose/view';
import {
  applyAiSelectionSuggestion,
  retryAiSelectionSuggestion,
} from '../../ai/selectionCommands';
import { floatingToolbarKey } from '../../floatingToolbarPlugin';
import { TOOLBAR_ACTIONS, type FloatingToolbarState } from '../../types';
import type { AiReviewElements } from './reviewDom';
import { toAiSelectionSuggestion } from './reviewState';
import { stopReviewMouseDown, syncReviewUi } from './reviewUi';

interface BindAiReviewActionsParams {
  elements: AiReviewElements;
  onClose: () => void;
  review: NonNullable<FloatingToolbarState['aiReview']>;
  updateReview: (nextReview: FloatingToolbarState['aiReview']) => void;
  view: EditorView;
}

export type ReviewBindingsCleanup = () => void;

export function bindAiReviewActions({
  elements,
  onClose,
  review,
  updateReview,
  view,
}: BindAiReviewActionsParams): ReviewBindingsCleanup {
  const { panel, acceptButton, retryButton, cancelButton, closeButton } = elements;
  const abortController = new AbortController();
  const { signal } = abortController;

  const getLiveReview = (): typeof review => review;

  const clearReview = () => {
    view.dispatch(
      view.state.tr.setMeta(floatingToolbarKey, {
        type: TOOLBAR_ACTIONS.CLEAR_AI_REVIEW,
      })
    );
  };

  const applySuggestion = () => {
    const suggestion = toAiSelectionSuggestion(getLiveReview());
    if (!suggestion) {
      return;
    }

    applyAiSelectionSuggestion(view, suggestion);
    onClose();
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

    if (acceptButton.disabled || review.isLoading) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    applySuggestion();
  };

  acceptButton.addEventListener('mousedown', stopReviewMouseDown, { signal });
  retryButton?.addEventListener('mousedown', stopReviewMouseDown, { signal });
  cancelButton.addEventListener('mousedown', stopReviewMouseDown, { signal });
  closeButton?.addEventListener('mousedown', stopReviewMouseDown, { signal });

  panel.addEventListener('keydown', handlePanelKeyDown, { signal });

  acceptButton.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    applySuggestion();
  }, { signal });

  cancelButton.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    clearReview();
  }, { signal });

  closeButton?.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    clearReview();
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

    updateReview({ ...liveReview, isLoading: true });
    void retryAiSelectionSuggestion(suggestion).then((nextSuggestion) => {
      const currentReview = floatingToolbarKey.getState(view.state)?.aiReview;
      if (!currentReview || currentReview.requestKey !== liveReview.requestKey) {
        return;
      }

      if (!nextSuggestion) {
        updateReview({ ...liveReview, isLoading: false });
        return;
      }

      updateReview({
        ...nextSuggestion,
        requestKey: liveReview.requestKey,
        isLoading: false,
      });
    });
  }, { signal });

  syncReviewUi(panel, review, acceptButton);

  return () => {
    abortController.abort();
  };
}
