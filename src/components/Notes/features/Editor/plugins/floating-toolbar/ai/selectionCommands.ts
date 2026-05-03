import type { EditorView } from '@milkdown/kit/prose/view';
export {
  createAiSelectionSuggestion,
  createAiSelectionSuggestionResult,
  retryAiSelectionSuggestion,
  retryAiSelectionSuggestionResult,
  __testing__,
} from './selectionRequest';
import { createAiSelectionSuggestion } from './selectionRequest';
export type {
  AiSelectionSuggestion,
  AiSelectionSuggestionResult,
  AiRequestOptions,
  SelectionSource,
} from './selectionCommandTypes';
import { applyAiSelectionSuggestion } from './selectionEditing';
export {
  applyAiSelectionSuggestion,
  getSerializedSelectionContext,
  getSerializedSelectionText,
} from './selectionEditing';

export async function executeAiSelectionInstruction(
  view: EditorView,
  instruction: string
): Promise<boolean> {
  const suggestion = await createAiSelectionSuggestion(view, instruction);
  if (!suggestion) {
    return false;
  }

  return applyAiSelectionSuggestion(view, suggestion);
}
