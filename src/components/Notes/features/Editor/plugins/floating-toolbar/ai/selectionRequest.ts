import type { EditorView } from '@milkdown/kit/prose/view';
import { openaiClient } from '@/lib/ai/providers/openai';
import type { AIModel, ChatMessage, Provider } from '@/lib/ai/types';
import { useToastStore } from '@/stores/useToastStore';
import { useUnifiedStore } from '@/stores/unified/useUnifiedStore';
import { buildEditorAiUserMessage } from './promptBuilder';
import { EDITOR_AI_SYSTEM_PROMPT } from './promptCatalog';
import { assertEnglishPromptText } from './promptValidation';
import { logAiSelectionDebug } from './debug';
import {
  type AiRequestOptions,
  type AiSelectionSuggestion,
  type AiSelectionSuggestionResult,
  type SelectionSource,
} from './selectionCommandTypes';
import { getSerializedSelectionText } from './selectionEditing';

interface AiRequestResult {
  suggestedText: string | null;
  errorMessage: string | null;
}

function createSystemMessage(content: string, modelId: string): ChatMessage {
  return {
    id: `editor-ai-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    role: 'system',
    content,
    modelId,
    timestamp: Date.now(),
  };
}

function stripThinkBlocks(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
}

function unwrapSingleCodeFence(text: string): string {
  const match = text.trim().match(/^```[\w-]*\n([\s\S]*?)\n```$/);
  if (!match) {
    return text;
  }
  return match[1] ?? '';
}

function normalizeAiEditedText(text: string): string {
  return unwrapSingleCodeFence(stripThinkBlocks(text)).trim();
}

function getSelectedModelAndProvider(): { model: AIModel; provider: Provider } | null {
  const ai = useUnifiedStore.getState().data.ai;
  logAiSelectionDebug('resolve-model:start', {
    hasAiState: Boolean(ai),
    selectedModelId: ai?.selectedModelId ?? null,
    providerCount: ai?.providers.length ?? 0,
    modelCount: ai?.models.length ?? 0,
  });

  if (!ai) {
    logAiSelectionDebug('resolve-model:missing-ai-state');
    return null;
  }

  const model = ai.selectedModelId
    ? ai.models.find((item) => item.id === ai.selectedModelId && item.enabled)
    : undefined;

  if (!model) {
    logAiSelectionDebug('resolve-model:model-not-found');
    return null;
  }

  const provider = ai.providers.find((item) => item.id === model.providerId && item.enabled);
  if (!provider) {
    logAiSelectionDebug('resolve-model:provider-not-found', {
      providerId: model.providerId,
    });
    return null;
  }

  logAiSelectionDebug('resolve-model:success', {
    modelId: model.id,
    apiModelId: model.apiModelId,
    providerId: provider.id,
    providerName: provider.name,
  });
  return { model, provider };
}

function buildSuggestion(
  from: number,
  to: number,
  instruction: string,
  originalText: string,
  suggestedText: string
): AiSelectionSuggestion {
  return {
    requestKey: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    from,
    to,
    instruction,
    commandId: null,
    toneId: null,
    originalText,
    suggestedText,
  };
}

async function requestAiEdit(
  instruction: string,
  selectedText: string,
  selectionRange?: { from: number; to: number },
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
    assertEnglishPromptText('requestAiEdit.instruction', trimmedInstruction);
    assertEnglishPromptText('requestAiEdit.systemPrompt', EDITOR_AI_SYSTEM_PROMPT);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'AI prompt must be English-only.';
    return reportError(message);
  }

  const resolved = getSelectedModelAndProvider();
  if (!resolved) {
    logAiSelectionDebug('execute:abort-missing-model');
    return reportError('Please configure and select an AI model first.');
  }

  const { model, provider } = resolved;
  const history: ChatMessage[] = [createSystemMessage(EDITOR_AI_SYSTEM_PROMPT, model.id)];
  const message = buildEditorAiUserMessage(trimmedInstruction, selectedText);
  logAiSelectionDebug('request:prepared', {
    modelId: model.id,
    apiModelId: model.apiModelId,
    providerId: provider.id,
    providerName: provider.name,
    selectedTextLength: selectedText.length,
    selectedTextPreview: selectedText.slice(0, 120),
    messageLength: message.length,
    messagePreview: message.slice(0, 200),
    selectionFrom: selectionRange?.from ?? null,
    selectionTo: selectionRange?.to ?? null,
  });

  try {
    const result = await openaiClient.sendMessage(
      message,
      history,
      model,
      provider,
      undefined,
      signal
    );
    logAiSelectionDebug('request:resolved', {
      resultLength: result.length,
      resultPreview: result.slice(0, 200),
    });
    const normalized = normalizeAiEditedText(result);
    logAiSelectionDebug('request:normalized', {
      normalizedLength: normalized.length,
      normalizedPreview: normalized.slice(0, 200),
    });

    if (normalized.length === 0) {
      logAiSelectionDebug('execute:abort-empty-model-result');
      return reportError('AI returned an empty result.');
    }

    return {
      suggestedText: normalized,
      errorMessage: null,
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      logAiSelectionDebug('request:aborted', {
        selectionFrom: selectionRange?.from ?? null,
        selectionTo: selectionRange?.to ?? null,
      });
      return {
        suggestedText: null,
        errorMessage: null,
      };
    }

    logAiSelectionDebug('request:error', {
      error:
        error instanceof Error
          ? {
              name: error.name,
              message: error.message,
              stack: error.stack,
            }
          : { value: String(error) },
    });
    const message =
      error instanceof Error && error.message.trim().length > 0
        ? error.message
        : 'Failed to edit the selected text with AI.';
    return reportError(message);
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
  const sourceFrom = selectionSource?.from ?? view.state.selection.from;
  const sourceTo = selectionSource?.to ?? view.state.selection.to;
  logAiSelectionDebug('execute:start', {
    instruction: trimmedInstruction,
    instructionLength: trimmedInstruction.length,
    selectionFrom: sourceFrom,
    selectionTo: sourceTo,
  });

  if (trimmedInstruction.length === 0) {
    logAiSelectionDebug('execute:abort-empty-instruction');
    useToastStore.getState().addToast('Please enter an AI instruction first.', 'warning');
    return { suggestion: null, errorMessage: null };
  }

  const from = sourceFrom;
  const to = sourceTo;
  if (from >= to) {
    logAiSelectionDebug('execute:abort-empty-selection', { from, to });
    useToastStore.getState().addToast('Please select some text first.', 'warning');
    return { suggestion: null, errorMessage: null };
  }

  const selectedText = selectionSource?.originalText ?? getSerializedSelectionText(view);
  if (selectedText.trim().length === 0) {
    logAiSelectionDebug('execute:abort-uneditable-selection', {
      rawLength: selectedText.length,
    });
    useToastStore.getState().addToast('The current selection cannot be edited by AI.', 'warning');
    return { suggestion: null, errorMessage: null };
  }

  const { suggestedText, errorMessage } = await requestAiEdit(
    trimmedInstruction,
    selectedText,
    { from, to },
    signal,
    options
  );
  if (suggestedText === null) {
    return { suggestion: null, errorMessage };
  }

  return {
    suggestion: buildSuggestion(
      from,
      to,
      trimmedInstruction,
      selectedText,
      suggestedText
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
  const { suggestedText, errorMessage } = await requestAiEdit(
    suggestion.instruction,
    suggestion.originalText,
    { from: suggestion.from, to: suggestion.to },
    signal,
    options
  );

  if (suggestedText === null) {
    return {
      suggestion: null,
      errorMessage,
    };
  }

  return {
    suggestion: buildSuggestion(
      suggestion.from,
      suggestion.to,
      suggestion.instruction,
      suggestion.originalText,
      suggestedText
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
