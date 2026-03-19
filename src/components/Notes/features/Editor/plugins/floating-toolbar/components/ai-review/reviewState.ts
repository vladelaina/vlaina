import type { AiSelectionSuggestion } from '../../ai/selectionCommands';
import type { FloatingToolbarState } from '../../types';

export function toAiSelectionSuggestion(
  review: FloatingToolbarState['aiReview']
): AiSelectionSuggestion | null {
  if (!review || !review.instruction) {
    return null;
  }

  return {
    requestKey: review.requestKey,
    instruction: review.instruction,
    commandId: review.commandId,
    toneId: review.toneId,
    from: review.from,
    to: review.to,
    originalText: review.originalText,
    suggestedText: review.suggestedText,
  };
}
