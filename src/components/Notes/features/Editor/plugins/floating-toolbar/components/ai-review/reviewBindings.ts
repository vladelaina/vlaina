import type { EditorView } from '@milkdown/kit/prose/view';
import { AI_REVIEW_COMMANDS, AI_REVIEW_TONE_COMMANDS } from '../../ai/constants';
import {
  applyAiSelectionSuggestion,
  retryAiSelectionSuggestion,
  type AiSelectionSuggestion,
} from '../../ai/selectionCommands';
import {
  runAiSelectionReviewCommand,
  runAiSelectionReviewPrompt,
  updateAiSelectionReviewPrompt,
} from '../../ai/reviewFlow';
import { floatingToolbarKey } from '../../floatingToolbarPlugin';
import { TOOLBAR_ACTIONS, type FloatingToolbarState } from '../../types';
import type { AiReviewElements } from './reviewDom';

interface BindAiReviewActionsParams {
  elements: AiReviewElements;
  onClose: () => void;
  review: NonNullable<FloatingToolbarState['aiReview']>;
  updateReview: (nextReview: FloatingToolbarState['aiReview']) => void;
  view: EditorView;
}

export function bindAiReviewActions({
  elements,
  onClose,
  review,
  updateReview,
  view,
}: BindAiReviewActionsParams) {
  const {
    acceptButton,
    retryButton,
    cancelButton,
    closeButton,
    promptInput,
    promptSubmitButton,
    commandButtons,
    toneButtons,
  } = elements;

  const toSuggestion = (
    nextReview: FloatingToolbarState['aiReview']
  ): AiSelectionSuggestion | null => {
    if (!nextReview || !nextReview.instruction) {
      return null;
    }

    return {
      instruction: nextReview.instruction,
      commandId: nextReview.commandId,
      toneId: nextReview.toneId,
      customPrompt: nextReview.customPrompt,
      from: nextReview.from,
      to: nextReview.to,
      originalText: nextReview.originalText,
      suggestedText: nextReview.suggestedText,
    };
  };

  const getLiveReview = (): typeof review => ({
    ...review,
    customPrompt: promptInput?.value ?? review.customPrompt,
  });

  const stopMouseDown = (event: MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
  };

  acceptButton.addEventListener('mousedown', stopMouseDown);
  retryButton.addEventListener('mousedown', stopMouseDown);
  cancelButton.addEventListener('mousedown', stopMouseDown);
  closeButton?.addEventListener('mousedown', stopMouseDown);
  promptSubmitButton?.addEventListener('mousedown', stopMouseDown);
  promptInput?.addEventListener('mousedown', (event) => {
    event.stopPropagation();
  });

  acceptButton.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();

    const suggestion = toSuggestion(review);
    if (!suggestion) {
      return;
    }

    applyAiSelectionSuggestion(view, suggestion);
    onClose();
  });

  const clearReview = () => {
    view.dispatch(
      view.state.tr.setMeta(floatingToolbarKey, {
        type: TOOLBAR_ACTIONS.CLEAR_AI_REVIEW,
      })
    );
  };

  cancelButton.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    clearReview();
  });

  closeButton?.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    clearReview();
  });

  promptInput?.addEventListener('input', (event) => {
    const target = event.currentTarget as HTMLInputElement;
    updateAiSelectionReviewPrompt(view, review, target.value);
  });

  promptInput?.addEventListener('keydown', (event) => {
    event.stopPropagation();
    if (
      event.key !== 'Enter' ||
      event.shiftKey ||
      review.isLoading ||
      promptInput.value.trim().length === 0
    ) {
      return;
    }

    event.preventDefault();
    void runAiSelectionReviewPrompt(view, getLiveReview());
  });

  promptSubmitButton?.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (review.isLoading || !promptInput) {
      return;
    }

    void runAiSelectionReviewPrompt(view, getLiveReview());
  });

  retryButton.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (review.isLoading) {
      return;
    }

    const liveReview = getLiveReview();
    const suggestion = toSuggestion(liveReview);
    if (!suggestion) {
      return;
    }

    updateReview({ ...liveReview, isLoading: true });
    void retryAiSelectionSuggestion(suggestion).then((nextSuggestion) => {
      if (!nextSuggestion) {
        updateReview({ ...liveReview, isLoading: false });
        return;
      }

      updateReview({
        ...nextSuggestion,
        isLoading: false,
      });
    });
  });

  commandButtons.forEach((button) => {
    button.addEventListener('mousedown', stopMouseDown);
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (review.isLoading) {
        return;
      }

      const commandId = button.dataset.reviewCommandId ?? '';
      const command = AI_REVIEW_COMMANDS.find((item) => item.id === commandId);
      if (!command) {
        return;
      }

      void runAiSelectionReviewCommand(view, getLiveReview(), {
        id: command.id,
        instruction: command.instruction,
        toneId: null,
      });
    });
  });

  toneButtons.forEach((button) => {
    button.addEventListener('mousedown', stopMouseDown);
    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (review.isLoading) {
        return;
      }

      const toneId = button.dataset.reviewToneId ?? '';
      const tone = AI_REVIEW_TONE_COMMANDS.find((item) => item.id === toneId);
      if (!tone) {
        return;
      }

      void runAiSelectionReviewCommand(view, getLiveReview(), {
        id: tone.id,
        instruction: tone.instruction,
        toneId: tone.id,
      });
    });
  });
}
