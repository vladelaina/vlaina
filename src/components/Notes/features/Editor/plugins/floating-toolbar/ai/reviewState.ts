import type { EditorView } from '@milkdown/kit/prose/view';
import {
  getSerializedSelectionContext,
  getSerializedSelectionText,
} from './selectionCommands';
import type { AiSelectionSuggestion, AiSelectionSuggestionResult } from './selectionCommandTypes';
import type { AiReviewState } from '../types';

function createReviewRequestKey(): string {
  return `review-${crypto.randomUUID()}`;
}

export function createAiReviewState(
  view: EditorView,
  prompt: string,
  commandId: string,
  toneId: string
): AiReviewState {
  const originalText = getSerializedSelectionText(view);
  const context = getSerializedSelectionContext(
    view,
    view.state.selection.from,
    view.state.selection.to,
    originalText
  );

  return {
    requestKey: createReviewRequestKey(),
    instruction: prompt,
    commandId: toneId ? null : commandId || null,
    toneId: toneId || null,
    from: view.state.selection.from,
    to: view.state.selection.to,
    originalText,
    beforeContext: context.beforeContext,
    afterContext: context.afterContext,
    suggestedText: '',
    isLoading: true,
    errorMessage: null,
  };
}

export function createEmptyAiReviewState(
  requestKey: string,
  from: number,
  to: number,
  originalText: string,
  beforeContext = '',
  afterContext = ''
): AiReviewState {
  return {
    requestKey,
    instruction: null,
    commandId: null,
    toneId: null,
    from,
    to,
    originalText,
    beforeContext,
    afterContext,
    suggestedText: '',
    isLoading: false,
    errorMessage: null,
  };
}

export function createLoadingAiReviewState(
  review: AiReviewState,
  requestKey: string,
  instruction: string,
  commandId: string,
  toneId?: string | null
): AiReviewState {
  return {
    ...review,
    requestKey,
    instruction,
    commandId,
    toneId: toneId ?? null,
    suggestedText: '',
    isLoading: true,
    errorMessage: null,
  };
}

export function createFailedAiReviewState(
  review: AiReviewState,
  requestKey: string,
  instruction: string,
  commandId: string,
  toneId: string | null | undefined,
  errorMessage: string | null
): AiReviewState {
  return {
    ...review,
    requestKey,
    instruction,
    commandId,
    toneId: toneId ?? null,
    suggestedText: '',
    isLoading: false,
    errorMessage,
  };
}

export function createResolvedAiReviewState(
  suggestion: AiSelectionSuggestion,
  requestKey: string,
  commandId: string,
  toneId?: string | null
): AiReviewState {
  return {
    ...suggestion,
    requestKey,
    commandId,
    toneId: toneId ?? null,
    isLoading: false,
    errorMessage: null,
  };
}

export function toResolvedAiReviewState(
  result: AiSelectionSuggestionResult,
  review: AiReviewState,
  requestKey: string,
  instruction: string,
  commandId: string,
  toneId?: string | null
): AiReviewState {
  if (!result.suggestion) {
    return createFailedAiReviewState(
      review,
      requestKey,
      instruction,
      commandId,
      toneId,
      result.errorMessage
    );
  }

  return createResolvedAiReviewState(result.suggestion, requestKey, commandId, toneId);
}
