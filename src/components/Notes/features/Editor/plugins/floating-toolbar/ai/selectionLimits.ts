export const MAX_AI_SELECTION_EDIT_CHARS = 1024 * 1024;

export const AI_SELECTION_TOO_LARGE_MESSAGE = 'The selected content is too large to edit with AI.';
export const AI_SELECTION_RESULT_TOO_LARGE_MESSAGE = 'The AI result is too large to apply.';

export function isAiSelectionTextTooLarge(text: string): boolean {
  return text.length > MAX_AI_SELECTION_EDIT_CHARS;
}

export function isAiSelectionRangeTooLarge(from: number, to: number): boolean {
  return to - from > MAX_AI_SELECTION_EDIT_CHARS;
}
