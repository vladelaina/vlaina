import { translate } from '@/lib/i18n';

export const MAX_AI_SELECTION_EDIT_CHARS = 1024 * 1024;

export const AI_SELECTION_TOO_LARGE_MESSAGE = 'The selected content is too large to edit with AI.';
export const AI_SELECTION_RESULT_TOO_LARGE_MESSAGE = 'The AI result is too large to apply.';

export function getAiSelectionTooLargeMessage(): string {
  return translate('editor.ai.selectionTooLarge');
}

export function getAiSelectionResultTooLargeMessage(): string {
  return translate('editor.ai.resultTooLarge');
}

export function isAiSelectionTextTooLarge(text: string): boolean {
  return text.length > MAX_AI_SELECTION_EDIT_CHARS;
}

export function isAiSelectionRangeTooLarge(from: number, to: number): boolean {
  return to - from > MAX_AI_SELECTION_EDIT_CHARS;
}
