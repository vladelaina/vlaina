import type { EditorView } from '@milkdown/kit/prose/view';
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { ChatLoading } from '@/components/Chat/features/Messages/components/ChatLoading';
import { floatingToolbarKey } from '../floatingToolbarKey';
import { TOOLBAR_ACTIONS, type FloatingToolbarState } from '../types';
import { runAiSelectionReviewCommand } from '../ai/reviewFlow';
import { AiToolbarModelSelector } from './AiToolbarModelSelector';
import { bindAiReviewActions, type ReviewBindingsCleanup } from './ai-review/reviewBindings';
import { getAiReviewElements } from './ai-review/reviewDom';

export interface AiReviewPanelController {
  render: (
    container: HTMLElement,
    view: EditorView,
    state: FloatingToolbarState,
    onClose: () => void
  ) => void;
  cleanup: () => void;
  destroy: () => void;
}

export function createAiReviewPanelController(): AiReviewPanelController {
  let modelSelectorRoot: Root | null = null;
  let loadingRoot: Root | null = null;
  let reviewBindingsCleanup: ReviewBindingsCleanup | null = null;

  const cleanup = () => {
    reviewBindingsCleanup?.();
    reviewBindingsCleanup = null;
    modelSelectorRoot?.unmount();
    modelSelectorRoot = null;
    loadingRoot?.unmount();
    loadingRoot = null;
  };

  const render = (
    container: HTMLElement,
    view: EditorView,
    state: FloatingToolbarState,
    onClose: () => void
  ) => {
    const review = state.aiReview;
    if (!review) {
      return;
    }

    const modelSelectorHost = container.querySelector('.ai-review-model-selector-slot');
    if (modelSelectorHost instanceof HTMLElement) {
      cleanup();
      modelSelectorRoot = createRoot(modelSelectorHost);
      modelSelectorRoot.render(
        React.createElement(AiToolbarModelSelector, {
          onSelectModel: () => {
            const toolbarState = floatingToolbarKey.getState(view.state);
            const liveReview = toolbarState?.aiReviews.find((item) => item.requestKey === review.requestKey)
              ?? (toolbarState?.aiReview?.requestKey === review.requestKey ? toolbarState.aiReview : null);
            if (!liveReview?.instruction) {
              return;
            }

            void runAiSelectionReviewCommand(view, liveReview, {
              id: liveReview.commandId ?? liveReview.toneId ?? 'custom',
              instruction: liveReview.instruction,
              toneId: liveReview.toneId ?? null,
            });
          },
        })
      );
    }

    const loadingHost = container.querySelector('.ai-review-loading-slot');
    if (loadingHost instanceof HTMLElement && review.isLoading) {
      loadingRoot = createRoot(loadingHost);
      loadingRoot.render(React.createElement(ChatLoading));
    }

    const elements = getAiReviewElements(container);
    if (!elements) {
      return;
    }

    const updateReview = (nextReview: FloatingToolbarState['aiReview']) => {
      view.dispatch(
        view.state.tr.setMeta(floatingToolbarKey, {
          type: TOOLBAR_ACTIONS.SET_AI_REVIEW,
          payload: { aiReview: nextReview },
        })
      );
    };

    reviewBindingsCleanup?.();
    reviewBindingsCleanup = bindAiReviewActions({
      elements,
      onClose,
      review,
      updateReview,
      view,
    });
  };

  return {
    render,
    cleanup,
    destroy() {
      cleanup();
    },
  };
}
