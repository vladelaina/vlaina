import type { EditorView } from '@milkdown/kit/prose/view';
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { floatingToolbarKey } from '../floatingToolbarPlugin';
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
  let reviewBindingsCleanup: ReviewBindingsCleanup | null = null;

  const cleanup = () => {
    reviewBindingsCleanup?.();
    reviewBindingsCleanup = null;
    modelSelectorRoot?.unmount();
    modelSelectorRoot = null;
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
            const liveReview = floatingToolbarKey.getState(view.state)?.aiReview;
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

    const elements = getAiReviewElements(container);
    if (!elements) {
      return;
    }

    if (!elements.panel.contains(document.activeElement)) {
      elements.panel.focus({ preventScroll: true });
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
