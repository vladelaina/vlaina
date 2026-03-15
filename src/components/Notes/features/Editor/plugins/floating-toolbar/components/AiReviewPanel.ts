import type { EditorView } from '@milkdown/kit/prose/view';
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { floatingToolbarKey } from '../floatingToolbarPlugin';
import { TOOLBAR_ACTIONS, type FloatingToolbarState } from '../types';
import { AiToolbarModelSelector } from './AiToolbarModelSelector';
import { bindAiReviewActions } from './ai-review/reviewBindings';
import { getAiReviewElements } from './ai-review/reviewDom';
import { bindAiReviewDrag } from './ai-review/reviewDrag';

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

  const cleanup = () => {
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
      modelSelectorRoot.render(React.createElement(AiToolbarModelSelector));
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

    bindAiReviewActions({
      elements,
      onClose,
      review,
      updateReview,
      view,
    });

    bindAiReviewDrag({
      container,
      dragHandle: elements.dragHandle,
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
