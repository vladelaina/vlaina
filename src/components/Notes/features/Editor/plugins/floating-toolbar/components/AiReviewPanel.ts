import type { EditorView } from '@milkdown/kit/prose/view';
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { ChatLoading } from '@/components/Chat/features/Messages/components/ChatLoading';
import { ErrorBlock } from '@/components/Chat/features/Messages/components/ErrorBlock';
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
  type RootSlot = {
    root: Root | null;
    unmountTimer: ReturnType<typeof setTimeout> | null;
  };
  const modelSelectorSlot: RootSlot = { root: null, unmountTimer: null };
  const loadingSlot: RootSlot = { root: null, unmountTimer: null };
  const errorSlot: RootSlot = { root: null, unmountTimer: null };
  let reviewBindingsCleanup: ReviewBindingsCleanup | null = null;

  const getRoot = (slot: RootSlot, host: HTMLElement): Root => {
    if (slot.unmountTimer) {
      globalThis.clearTimeout(slot.unmountTimer);
      slot.unmountTimer = null;
    }
    slot.root ??= createRoot(host);
    return slot.root;
  };

  const deferUnmount = (slot: RootSlot) => {
    if (!slot.root || slot.unmountTimer) return;
    slot.unmountTimer = globalThis.setTimeout(() => {
      slot.root?.unmount();
      slot.root = null;
      slot.unmountTimer = null;
    }, 0);
  };

  const cleanup = () => {
    reviewBindingsCleanup?.();
    reviewBindingsCleanup = null;
    deferUnmount(modelSelectorSlot);
    deferUnmount(loadingSlot);
    deferUnmount(errorSlot);
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
      reviewBindingsCleanup?.();
      reviewBindingsCleanup = null;
      getRoot(modelSelectorSlot, modelSelectorHost).render(
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
            }).catch(() => undefined);
          },
        })
      );
    }

    const loadingHost = container.querySelector('.ai-review-loading-slot');
    if (loadingHost instanceof HTMLElement) {
      getRoot(loadingSlot, loadingHost).render(review.isLoading ? React.createElement(ChatLoading) : null);
    }

    const errorHost = container.querySelector('.ai-review-error-slot');
    if (errorHost instanceof HTMLElement) {
      getRoot(errorSlot, errorHost).render(
        review.errorMessage
          ? React.createElement(ErrorBlock, {
              content: review.errorMessage,
              showLoginPrompt: review.errorType === 'AUTH_ERROR',
            })
          : null
      );
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
