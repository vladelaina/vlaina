import type { EditorView } from '@milkdown/kit/prose/view';
import { useToastStore } from '@/stores/useToastStore';
import { floatingToolbarKey } from '../floatingToolbarPlugin';
import { TOOLBAR_ACTIONS, type AiReviewState } from '../types';
import {
  createAiSelectionSuggestionResult,
  getSerializedSelectionText,
} from './selectionCommands';
import {
  createEmptyAiReviewState,
  createLoadingAiReviewState,
  toResolvedAiReviewState,
} from './reviewState';
import { ensureReviewSelectionVisible } from './reviewSelection';

const activeReviewControllers = new Map<string, AbortController>();

function getActiveReviewRequestKey(view: EditorView): string | null {
  return floatingToolbarKey.getState(view.state)?.aiReview?.requestKey ?? null;
}

function abortReviewRequest(requestKey: string | null) {
  if (!requestKey) {
    return;
  }

  const controller = activeReviewControllers.get(requestKey);
  if (!controller) {
    return;
  }

  controller.abort();
  activeReviewControllers.delete(requestKey);
}

export function abortActiveAiSelectionReview(view: EditorView): void {
  abortReviewRequest(getActiveReviewRequestKey(view));
}

export function openAiSelectionReview(view: EditorView, requestKey?: string): boolean {
  const { from, to } = view.state.selection;
  if (from >= to) {
    useToastStore.getState().addToast('Please select some text first.', 'warning');
    return false;
  }

  const originalText = getSerializedSelectionText(view);
  if (originalText.trim().length === 0) {
    useToastStore.getState().addToast('The current selection cannot be edited by AI.', 'warning');
    return false;
  }

  ensureReviewSelectionVisible(view, from, to);

  view.dispatch(
    view.state.tr.setMeta(floatingToolbarKey, {
      type: TOOLBAR_ACTIONS.SET_AI_REVIEW,
      payload: {
        dragPosition: null,
        aiReview: createEmptyAiReviewState(
          requestKey ?? `review-${crypto.randomUUID()}`,
          from,
          to,
          originalText
        ),
      },
    })
  );
  return true;
}

export async function runAiSelectionReviewCommand(
  view: EditorView,
  review: AiReviewState,
  command: {
    id: string;
    instruction: string;
    toneId?: string | null;
  }
): Promise<boolean> {
  const instruction = command.instruction.trim();
  if (!instruction) {
    return false;
  }

  const requestKey = review.requestKey || `review-${crypto.randomUUID()}`;
  abortReviewRequest(requestKey);
  ensureReviewSelectionVisible(view, review.from, review.to);

  view.dispatch(
    view.state.tr.setMeta(floatingToolbarKey, {
      type: TOOLBAR_ACTIONS.SET_AI_REVIEW,
      payload: {
        aiReview: createLoadingAiReviewState(
          review,
          requestKey,
          instruction,
          command.id,
          command.toneId
        ),
      },
    })
  );

  const reviewSelection = {
    from: review.from,
    to: review.to,
    originalText: review.originalText,
  };
  const controller = new AbortController();
  activeReviewControllers.set(requestKey, controller);

  try {
    const { suggestion, errorMessage } = await createAiSelectionSuggestionResult(
      view,
      instruction,
      reviewSelection,
      controller.signal,
      { suppressToast: true }
    );
    if (controller.signal.aborted) {
      return false;
    }

    if (!suggestion) {
      if (getActiveReviewRequestKey(view) !== requestKey) {
        return false;
      }

      view.dispatch(
        view.state.tr.setMeta(floatingToolbarKey, {
          type: TOOLBAR_ACTIONS.SET_AI_REVIEW,
          payload: {
            aiReview: toResolvedAiReviewState(
              { suggestion: null, errorMessage },
              review,
              requestKey,
              instruction,
              command.id,
              command.toneId
            ),
          },
        })
      );
      return false;
    }

    if (getActiveReviewRequestKey(view) !== requestKey) {
      return false;
    }

    view.dispatch(
      view.state.tr.setMeta(floatingToolbarKey, {
        type: TOOLBAR_ACTIONS.SET_AI_REVIEW,
        payload: {
          aiReview: toResolvedAiReviewState(
            { suggestion, errorMessage: null },
            review,
            requestKey,
            instruction,
            command.id,
            command.toneId
          ),
        },
      })
    );
    return true;
  } finally {
    if (activeReviewControllers.get(requestKey) === controller) {
      activeReviewControllers.delete(requestKey);
    }
  }
}
