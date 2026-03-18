import type { EditorView } from '@milkdown/kit/prose/view';
import { useToastStore } from '@/stores/useToastStore';
import { floatingToolbarKey } from '../floatingToolbarPlugin';
import { TOOLBAR_ACTIONS, type AiReviewState } from '../types';
import {
  createAiSelectionSuggestion,
  getSerializedSelectionText,
} from './selectionCommands';

const activeReviewControllers = new Map<string, AbortController>();

function createReviewRequestKey(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

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

  view.dispatch(
    view.state.tr.setMeta(floatingToolbarKey, {
      type: TOOLBAR_ACTIONS.SET_AI_REVIEW,
      payload: {
        dragPosition: null,
        aiReview: {
          requestKey: requestKey ?? createReviewRequestKey(),
          instruction: null,
          commandId: null,
          toneId: null,
          from,
          to,
          originalText,
          suggestedText: '',
          isLoading: false,
        },
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

  const requestKey = review.requestKey || createReviewRequestKey();
  abortReviewRequest(requestKey);

  view.dispatch(
    view.state.tr.setMeta(floatingToolbarKey, {
      type: TOOLBAR_ACTIONS.SET_AI_REVIEW,
      payload: {
        aiReview: {
          ...review,
          requestKey,
          instruction,
          commandId: command.id,
          toneId: command.toneId ?? null,
          suggestedText: '',
          isLoading: true,
        },
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
    const suggestion = await createAiSelectionSuggestion(
      view,
      instruction,
      reviewSelection,
      controller.signal
    );
    if (!suggestion) {
      if (getActiveReviewRequestKey(view) !== requestKey) {
        return false;
      }

      view.dispatch(
        view.state.tr.setMeta(floatingToolbarKey, {
          type: TOOLBAR_ACTIONS.SET_AI_REVIEW,
          payload: {
            aiReview: {
              ...review,
              requestKey,
              instruction,
              commandId: command.id,
              toneId: command.toneId ?? null,
              isLoading: false,
            },
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
          aiReview: {
            ...suggestion,
            requestKey,
            commandId: command.id,
            toneId: command.toneId ?? null,
            isLoading: false,
          },
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
