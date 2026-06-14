import type { EditorView } from '@milkdown/kit/prose/view';
import { stripThinkingContent } from '@/lib/ai/stripThinkingContent';
import type { AIModel, ChatMessage, Provider } from '@/lib/ai/types';
import { useToastStore } from '@/stores/useToastStore';
import { translate } from '@/lib/i18n';
import { useUnifiedStore } from '@/stores/unified/useUnifiedStore';
import { sendMessageWithEndpointFallback } from '@/hooks/chatService/sendMessageWithEndpointFallback';
import { getUserFacingAIError } from '@/lib/ai/errors';
import { isManagedProviderId } from '@/lib/ai/managedService';
import { parseStandaloneFencedCodeBlock } from '../../clipboard/fencedCodePaste';
import { hasSelectedBlocks } from '../../cursor/blockSelectionPluginState';
import {
  boundEditorAiContext,
  buildEditorAiUserMessage,
  MAX_EDITOR_AI_INSTRUCTION_CHARS,
} from './promptBuilder';
import { EDITOR_AI_SYSTEM_PROMPT } from './promptCatalog';
import { assertEnglishPromptText } from './promptValidation';
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
  AI_SELECTION_RESULT_TOO_LARGE_MESSAGE,
  AI_SELECTION_TOO_LARGE_MESSAGE,
  isAiSelectionRangeTooLarge,
  isAiSelectionTextTooLarge,
} from './selectionLimits';

interface AiRequestResult {
  suggestedText: string | null;
  errorMessage: string | null;
  errorType?: string | null;
  errorCode?: string | null;
}

function boundSelectionContext(context: {
  beforeContext?: string;
  afterContext?: string;
}): { beforeContext: string; afterContext: string } {
  return {
    beforeContext: boundEditorAiContext(context.beforeContext ?? ''),
    afterContext: boundEditorAiContext(context.afterContext ?? ''),
  };
}

function createSystemMessage(content: string, modelId: string): ChatMessage {
  const now = Date.now();
  return {
    id: `editor-ai-${crypto.randomUUID()}`,
    role: 'system',
    content,
    modelId,
    timestamp: now,
    versions: [{ content, createdAt: now, kind: 'original', subsequentMessages: [] }],
    currentVersionIndex: 0,
  };
}

function unwrapSingleCodeFence(text: string): string {
  return parseStandaloneFencedCodeBlock(text)?.code ?? text;
}

function normalizeAiEditedText(text: string): string {
  return unwrapSingleCodeFence(stripThinkingContent(text)).trim();
}

function getSelectedModelAndProvider(): { model: AIModel; provider: Provider } | null {
  const ai = useUnifiedStore.getState().data.ai;

  if (!ai) {
    return null;
  }

  const model = ai.selectedModelId
    ? ai.models.find((item) => item.id === ai.selectedModelId && item.enabled)
    : undefined;

  if (!model) {
    return null;
  }

  const provider = ai.providers.find((item) => item.id === model.providerId && item.enabled);
  if (!provider) {
    return null;
  }

  return { model, provider };
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

async function requestAiEdit(
  instruction: string,
  selectedText: string,
  context?: { beforeContext?: string; afterContext?: string },
  signal?: AbortSignal,
  options?: AiRequestOptions
): Promise<AiRequestResult> {
  const trimmedInstruction = instruction.trim();
  const reportError = (message: string): AiRequestResult => {
    if (!options?.suppressToast) {
      useToastStore.getState().addToast(message, 'error', 4000);
    }
    return {
      suggestedText: null,
      errorMessage: message,
    };
  };

  try {
    if (trimmedInstruction.length > MAX_EDITOR_AI_INSTRUCTION_CHARS) {
      return reportError('AI instruction is too large.');
    }
    assertEnglishPromptText('requestAiEdit.instruction', trimmedInstruction);
    assertEnglishPromptText('requestAiEdit.systemPrompt', EDITOR_AI_SYSTEM_PROMPT);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'AI prompt must be English-only.';
    return reportError(message);
  }

  const resolved = getSelectedModelAndProvider();
  if (!resolved) {
    return reportError('Please configure and select an AI model first.');
  }

  const { model, provider } = resolved;
  const history: ChatMessage[] = [createSystemMessage(EDITOR_AI_SYSTEM_PROMPT, model.id)];
  const message = buildEditorAiUserMessage(trimmedInstruction, selectedText, context);

  try {
    const result = await sendMessageWithEndpointFallback({
      content: message,
      history,
      model,
      provider,
      onChunk: () => {},
      signal,
    });
    const normalized = normalizeAiEditedText(result);

    if (normalized.length === 0) {
      return reportError('AI returned an empty result.');
    }
    if (isAiSelectionTextTooLarge(normalized)) {
      return reportError(AI_SELECTION_RESULT_TOO_LARGE_MESSAGE);
    }

    return {
      suggestedText: normalized,
      errorMessage: null,
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return {
        suggestedText: null,
        errorMessage: null,
      };
    }

    const fallbackMessage =
      error instanceof Error && error.message.trim().length > 0
        ? error.message
        : 'Failed to edit the selected text with AI.';
    const isManaged = isManagedProviderId(provider.id);
    const normalized = isManaged ? getUserFacingAIError(error) : null;
    const message = normalized?.message || fallbackMessage;
    if (!options?.suppressToast) {
      useToastStore.getState().addToast(message, 'error', 4000);
    }
    return {
      suggestedText: null,
      errorMessage: message,
      errorType: normalized?.type ?? null,
      errorCode: normalized?.code ?? null,
    };
  }
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
    return reportSelectionError(AI_SELECTION_TOO_LARGE_MESSAGE);
  }

  const selectedText = selectionSource?.originalText ?? getSerializedSelectionText(view);
  if (isAiSelectionTextTooLarge(selectedText)) {
    return reportSelectionError(AI_SELECTION_TOO_LARGE_MESSAGE);
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
    if (!options?.suppressToast) {
      useToastStore.getState().addToast(AI_SELECTION_TOO_LARGE_MESSAGE, 'warning');
    }
    return { suggestion: null, errorMessage: AI_SELECTION_TOO_LARGE_MESSAGE };
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
