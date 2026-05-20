import type { EditorView } from '@milkdown/kit/prose/view';
import { floatingToolbarKey } from '../floatingToolbarKey';

const activeReviewControllers = new Map<string, AbortController>();

function getActiveReviewRequestKey(view: EditorView): string | null {
  return floatingToolbarKey.getState(view.state)?.aiReview?.requestKey ?? null;
}

export function setAiSelectionReviewController(requestKey: string, controller: AbortController) {
  activeReviewControllers.set(requestKey, controller);
}

export function clearAiSelectionReviewController(requestKey: string, controller: AbortController) {
  if (activeReviewControllers.get(requestKey) === controller) {
    activeReviewControllers.delete(requestKey);
  }
}

export function abortAiSelectionReviewRequest(requestKey: string | null) {
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
  abortAiSelectionReviewRequest(getActiveReviewRequestKey(view));
}

export function abortAllAiSelectionReviews(view: EditorView): void {
  const toolbarState = floatingToolbarKey.getState(view.state);
  const requestKeys = new Set<string>();
  if (toolbarState?.aiReview) {
    requestKeys.add(toolbarState.aiReview.requestKey);
  }

  toolbarState?.aiReviews.forEach((review) => {
    requestKeys.add(review.requestKey);
  });

  requestKeys.forEach((requestKey) => {
    abortAiSelectionReviewRequest(requestKey);
  });
}
