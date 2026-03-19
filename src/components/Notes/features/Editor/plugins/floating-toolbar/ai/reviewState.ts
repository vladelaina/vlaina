import type { EditorView } from '@milkdown/kit/prose/view';
import { getSerializedSelectionText } from './selectionCommands';
import type { AiSelectionSuggestion, AiSelectionSuggestionResult } from './selectionCommandTypes';
import type { AiReviewState } from '../types';

function createReviewRequestKey(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createAiReviewState(
  view: EditorView,
  prompt: string,
  commandId: string,
  toneId: string
): AiReviewState {
  return {
    requestKey: createReviewRequestKey(),
    instruction: prompt,
    commandId: toneId ? null : commandId || null,
    toneId: toneId || null,
    from: view.state.selection.from,
    to: view.state.selection.to,
    originalText: getSerializedSelectionText(view),
    suggestedText: '',
    isLoading: true,
    errorMessage: null,
  };
}

export function createEmptyAiReviewState(
  requestKey: string,
  from: number,
  to: number,
  originalText: string
): AiReviewState {
  return {
    requestKey,
    instruction: null,
    commandId: null,
    toneId: null,
    from,
    to,
    originalText,
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
