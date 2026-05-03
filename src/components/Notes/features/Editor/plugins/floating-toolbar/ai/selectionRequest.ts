import type { EditorView } from '@milkdown/kit/prose/view';
import { openaiClient } from '@/lib/ai/providers/openai';
import type { AIModel, ChatMessage, Provider } from '@/lib/ai/types';
import { useToastStore } from '@/stores/useToastStore';
import { useUnifiedStore } from '@/stores/unified/useUnifiedStore';
import { buildEditorAiUserMessage } from './promptBuilder';
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

interface AiRequestResult {
  suggestedText: string | null;
  errorMessage: string | null;
}

function createSystemMessage(content: string, modelId: string): ChatMessage {
  const now = Date.now();
  return {
    id: `editor-ai-${crypto.randomUUID()}`,
    role: 'system',
    content,
    modelId,
    timestamp: now,
    versions: [{ content, createdAt: now, subsequentMessages: [] }],
    currentVersionIndex: 0,
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
    const result = await openaiClient.sendMessage(
      message,
      history,
      model,
      provider,
      undefined,
      signal
    );
    const normalized = normalizeAiEditedText(result);

    if (normalized.length === 0) {
      return reportError('AI returned an empty result.');
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

  if (trimmedInstruction.length === 0) {
    useToastStore.getState().addToast('Please enter an AI instruction first.', 'warning');
    return { suggestion: null, errorMessage: null };
  }

  const from = sourceFrom;
  const to = sourceTo;
  if (from >= to) {
    useToastStore.getState().addToast('Please select some text first.', 'warning');
    return { suggestion: null, errorMessage: null };
  }

  const selectedText = selectionSource?.originalText ?? getSerializedSelectionText(view);
  if (selectedText.trim().length === 0) {
    useToastStore.getState().addToast('The current selection cannot be edited by AI.', 'warning');
    return { suggestion: null, errorMessage: null };
  }
  const context = selectionSource
    ? {
        beforeContext: selectionSource.beforeContext ?? '',
        afterContext: selectionSource.afterContext ?? '',
      }
    : getSerializedSelectionContext(view, from, to, selectedText);

  const { suggestedText, errorMessage } = await requestAiEdit(
    trimmedInstruction,
    selectedText,
    context,
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
      suggestedText,
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
  const { suggestedText, errorMessage } = await requestAiEdit(
    suggestion.instruction,
    suggestion.originalText,
    {
      beforeContext: suggestion.beforeContext ?? '',
      afterContext: suggestion.afterContext ?? '',
    },
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
      suggestedText,
      suggestion.beforeContext ?? '',
      suggestion.afterContext ?? ''
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
