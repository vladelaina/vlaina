import type { EditorView } from '@milkdown/kit/prose/view';
import { useToastStore } from '@/stores/useToastStore';
import { translate } from '@/lib/i18n';
import { hasSelectedBlocks } from '../../cursor/blockSelectionPluginState';
import {
  boundEditorAiContext,
  buildEditorAiUserMessage,
} from './promptBuilder';
import {
  type AiRequestOptions,
  type AiSelectionSuggestion,
  type AiSelectionSuggestionResult,
  type SelectionSource,
} from './selectionCommandTypes';
import {
  getSerializedSelectionContext,
  getSerializedSelectionText,
} from './selectionEditing';
import {
  getAiSelectionTooLargeMessage,
  isAiSelectionRangeTooLarge,
  isAiSelectionTextTooLarge,
} from './selectionLimits';
import { normalizeAiEditedText, requestAiEdit } from './selectionAiRequest';

function boundSelectionContext(context: {
  beforeContext?: string;
  afterContext?: string;
}): { beforeContext: string; afterContext: string } {
  return {
    beforeContext: boundEditorAiContext(context.beforeContext ?? ''),
    afterContext: boundEditorAiContext(context.afterContext ?? ''),
  };
}

function buildSuggestion(
  from: number,
  to: number,
  instruction: string,
  originalText: string,
  suggestedText: string,
  beforeContext = '',
  afterContext = ''
): AiSelectionSuggestion {
  return {
    requestKey: `review-${crypto.randomUUID()}`,
    from,
    to,
    instruction,
    commandId: null,
    toneId: null,
    originalText,
    beforeContext,
    afterContext,
    suggestedText,
  };
}

export async function createAiSelectionSuggestionResult(
  view: EditorView,
  instruction: string,
  selectionSource?: SelectionSource,
  signal?: AbortSignal,
  options?: AiRequestOptions
): Promise<AiSelectionSuggestionResult> {
  const trimmedInstruction = instruction.trim();
  const reportSelectionError = (message: string): AiSelectionSuggestionResult => {
    if (!options?.suppressToast) {
      useToastStore.getState().addToast(message, 'warning');
    }
    return { suggestion: null, errorMessage: message };
  };

  if (!selectionSource && hasSelectedBlocks(view.state)) {
    useToastStore.getState().addToast(translate('editor.ai.cannotEditSelection'), 'warning');
    return { suggestion: null, errorMessage: null };
  }

  const sourceFrom = selectionSource?.from ?? view.state.selection.from;
  const sourceTo = selectionSource?.to ?? view.state.selection.to;

  if (trimmedInstruction.length === 0) {
    useToastStore.getState().addToast(translate('editor.ai.instructionRequired'), 'warning');
    return { suggestion: null, errorMessage: null };
  }

  const from = sourceFrom;
  const to = sourceTo;
  if (from >= to) {
    useToastStore.getState().addToast(translate('editor.ai.selectTextFirst'), 'warning');
    return { suggestion: null, errorMessage: null };
  }

  if (!selectionSource && isAiSelectionRangeTooLarge(from, to)) {
    return reportSelectionError(getAiSelectionTooLargeMessage());
  }

  const selectedText = selectionSource?.originalText ?? getSerializedSelectionText(view);
  if (isAiSelectionTextTooLarge(selectedText)) {
    return reportSelectionError(getAiSelectionTooLargeMessage());
  }
  if (selectedText.trim().length === 0) {
    useToastStore.getState().addToast(translate('editor.ai.cannotEditSelection'), 'warning');
    return { suggestion: null, errorMessage: null };
  }
  const context = boundSelectionContext(
    selectionSource
      ? {
          beforeContext: selectionSource.beforeContext,
          afterContext: selectionSource.afterContext,
        }
      : getSerializedSelectionContext(view, from, to, selectedText)
  );

  const result = await requestAiEdit(
    trimmedInstruction,
    selectedText,
    context,
    signal,
    options
  );
  if (result.suggestedText === null) {
    return {
      suggestion: null,
      errorMessage: result.errorMessage,
      errorType: result.errorType,
      errorCode: result.errorCode,
    };
  }

  return {
    suggestion: buildSuggestion(
      from,
      to,
      trimmedInstruction,
      selectedText,
      result.suggestedText,
      context.beforeContext,
      context.afterContext
    ),
    errorMessage: null,
  };
}

export async function createAiSelectionSuggestion(
  view: EditorView,
  instruction: string,
  selectionSource?: SelectionSource,
  signal?: AbortSignal
): Promise<AiSelectionSuggestion | null> {
  const { suggestion } = await createAiSelectionSuggestionResult(
    view,
    instruction,
    selectionSource,
    signal
  );
  return suggestion;
}

export async function retryAiSelectionSuggestionResult(
  suggestion: AiSelectionSuggestion,
  signal?: AbortSignal,
  options?: AiRequestOptions
): Promise<AiSelectionSuggestionResult> {
  if (isAiSelectionTextTooLarge(suggestion.originalText)) {
    const message = getAiSelectionTooLargeMessage();
    if (!options?.suppressToast) {
      useToastStore.getState().addToast(message, 'warning');
    }
    return { suggestion: null, errorMessage: message };
  }

  const context = boundSelectionContext({
    beforeContext: suggestion.beforeContext,
    afterContext: suggestion.afterContext,
  });
  const result = await requestAiEdit(
    suggestion.instruction,
    suggestion.originalText,
    context,
    signal,
    options
  );

  if (result.suggestedText === null) {
    return {
      suggestion: null,
      errorMessage: result.errorMessage,
      errorType: result.errorType,
      errorCode: result.errorCode,
    };
  }

  return {
    suggestion: buildSuggestion(
      suggestion.from,
      suggestion.to,
      suggestion.instruction,
      suggestion.originalText,
      result.suggestedText,
      context.beforeContext,
      context.afterContext
    ),
    errorMessage: null,
  };
}

export async function retryAiSelectionSuggestion(
  suggestion: AiSelectionSuggestion,
  signal?: AbortSignal
): Promise<AiSelectionSuggestion | null> {
  const { suggestion: nextSuggestion } = await retryAiSelectionSuggestionResult(
    suggestion,
    signal
  );
  return nextSuggestion;
}

export const __testing__ = {
  buildEditorAiUserMessage,
  normalizeAiEditedText,
};
