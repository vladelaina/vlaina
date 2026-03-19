import type { AiReviewState } from '../types';

export type AiSelectionSuggestion = Omit<AiReviewState, 'isLoading' | 'instruction' | 'errorMessage'> & {
  instruction: string;
};

export interface AiRequestOptions {
  suppressToast?: boolean;
}

export interface AiSelectionSuggestionResult {
  suggestion: AiSelectionSuggestion | null;
  errorMessage: string | null;
}

export interface SelectionSource {
  from: number;
  to: number;
  originalText: string;
}
