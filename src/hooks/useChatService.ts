import { useCallback, useMemo, useRef, useState } from 'react';
import { actions as aiActions } from '@/stores/useAIStore';
import {
  convertToBase64,
  deleteAttachment,
  type Attachment,
} from '@/lib/storage/attachmentStorage';
import { isStoredAttachmentSrc } from '@/lib/storage/attachmentUrl';
import type { ChatMessageContent, ChatMessageContentPart } from '@/lib/ai/types';
import type { NoteMentionReference } from '@/lib/ai/noteMentions';
import { buildRequestHistory } from '@/lib/ai/requestContext';
import { isManagedProviderId } from '@/lib/ai/managedService';
import { useUnifiedStore } from '@/stores/unified/useUnifiedStore';
import { useAIUIStore } from '@/stores/ai/chatState';
import { useAccountSessionStore } from '@/stores/accountSession';
import { applyManagedQuotaExhaustedSnapshot, useManagedAIStore } from '@/stores/useManagedAIStore';
import { useAutoTitle } from './useAutoTitle';
import { requestManager } from '@/lib/ai/requestManager';
import { getUserFacingAIError } from '@/lib/ai/errors';
import { buildErrorTag } from '@/lib/ai/errorTag';
import { AIErrorType } from '@/lib/ai/types';
import { isManagedBudgetExhausted } from '@/lib/ai/managedQuota';
import {
  isTemporarySession,
  isTemporarySessionId,
  needsAutoTitle,
} from '@/lib/ai/temporaryChat';
import { runWithSessionMutationLock } from '@/lib/ai/sessionMutationLock';
import { resolveSessionIdAlias } from '@/lib/ai/sessionIdAliases';
import {
  buildMentionedNotesContext,
  buildMessageFileAttachmentContext,
  buildMessageImageSources,
  buildStoredUserMessageContent,
  isAllowedChatImageAttachmentPath,
  loadMentionedNotes,
  loadMentionedFolderImageAttachments,
  normalizeNoteMentions,
  normalizeVisionAttachment,
  refreshManagedBudgetIfNeeded,
  isImageAttachment,
  isTextAttachment,
  limitChatMessageAttachments,
  limitChatMessageImageAttachments,
} from './chatService/helpers';
import { runStreamedAssistantMessage } from './chatService/runStreamedAssistantMessage';
import { sendMessageWithEndpointFallback } from './chatService/sendMessageWithEndpointFallback';
import { hydrateSessionMessagesFromDisk } from '@/stores/ai/sessionConsistency';
import { translate, useI18n } from '@/lib/i18n';
import {
  ACCOUNT_AUTH_INVALIDATED_EVENT,
  ACCOUNT_LOGIN_REQUESTED_EVENT,
} from '@/lib/account/sessionEvent';
import { addChatDebugLog } from '@/lib/debug/chatDebugLog';
import { limitChatComposerText } from '@/lib/ui/composerTextLimit';

const INVISIBLE_BREAK_REGEX = /[\u200b\u200c\u200d\ufeff]/g;
const UNIVERSAL_NEWLINE_REGEX = /\r\n?|\u2028|\u2029|\u0085/g;
const EMPTY_MESSAGES: never[] = [];
const EMPTY_PROVIDERS: never[] = [];
const EMPTY_MODELS: never[] = [];

function primitiveToString(value: unknown): string {
  if (value == null) {
    return '';
  }
  switch (typeof value) {
    case 'string':
      return value;
    case 'number':
    case 'boolean':
    case 'bigint':
    case 'symbol':
      return String(value);
    default:
      return '';
  }
}

function extractRawErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }
  if (error && typeof error === 'object' && typeof (error as { message?: unknown }).message === 'string') {
    const message = (error as { message: string }).message.trim();
    if (message) {
      return message;
    }
  }
  return primitiveToString(error).trim() || 'AI request failed.';
}

function dispatchAccountAuthInvalidated() {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new Event(ACCOUNT_AUTH_INVALIDATED_EVENT));
}

function requestManagedAccountSignIn(sessionId?: string | null) {
  if (sessionId) {
    useAIUIStore.getState().setAuthPromptSessionId(sessionId);
  }
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new Event(ACCOUNT_LOGIN_REQUESTED_EVENT));
}

function buildChatErrorPayload(error: unknown, managed = true) {
  if (!managed) {
    const message = extractRawErrorMessage(error);
    return {
      message,
      xml: buildErrorTag('custom_provider', '', message),
    };
  }

  const normalized = getUserFacingAIError(error);
  if (normalized.type === AIErrorType.QUOTA_EXHAUSTED) {
    applyManagedQuotaExhaustedSnapshot();
  }
  if (normalized.type === AIErrorType.AUTH_ERROR) {
    dispatchAccountAuthInvalidated();
  }

  if (normalized.type === AIErrorType.NETWORK_ERROR) {
    const message = translate('chat.error.upstreamUnavailable');
    return {
      message,
      xml: buildErrorTag(AIErrorType.SERVER_ERROR, 'upstream_unavailable', message),
    };
  }

  return {
    message: normalized.message,
    xml: buildErrorTag(normalized.type, normalized.code, normalized.message),
  };
}

function createEmptyResponseError(providerId: string): Error {
  return new Error(isManagedProviderId(providerId) ? 'UPSTREAM_UNAVAILABLE' : 'The model returned an empty response.');
}

function throwIfChatRequestAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return;
  throw new DOMException('Aborted', 'AbortError');
}

function isChatRequestCancelled(sessionId: string, controller: AbortController): boolean {
  return controller.signal.aborted || !requestManager.isCurrent(sessionId, controller);
}

function finishPreStartedChatRequest(
  sessionId: string,
  controller: AbortController,
  setSessionLoading: (sessionId: string, loading: boolean) => void,
) {
  if (requestManager.isCurrent(sessionId, controller)) {
    setSessionLoading(sessionId, false);
  }
  requestManager.finish(sessionId, controller);
}

export const MAX_TEMPORARY_ATTACHMENT_EPHEMERAL_CONCURRENCY = 4;

interface ActiveComposerRequest {
  sessionId: string;
  controller: AbortController;
  submittedText: string;
  submittedAttachments: Attachment[];
  submittedNoteMentions: NoteMentionReference[];
  userMessageId: string | null;
  assistantMessageId: string | null;
}

export interface RecalledComposerDraft {
  message: string;
  attachments: Attachment[];
  noteMentions: NoteMentionReference[];
}

export interface PendingRecalledComposerDraft extends RecalledComposerDraft {
  id: number;
}

function shouldBlockManagedRequestForKnownBudget(providerId: string): boolean {
  if (!isManagedProviderId(providerId)) {
    return false;
  }

  const { budget } = useManagedAIStore.getState();
  return isManagedBudgetExhausted(budget);
}

async function shouldBlockManagedRequestAfterBudgetRefresh(providerId: string): Promise<boolean> {
  if (!shouldBlockManagedRequestForKnownBudget(providerId)) {
    return false;
  }

  try {
    await useManagedAIStore.getState().refreshBudget();
  } catch {
    // Keep the known exhausted state below when the refresh fails.
  }

  return isManagedBudgetExhausted(useManagedAIStore.getState().budget);
}

function markManagedQuotaExhausted(): void {
  applyManagedQuotaExhaustedSnapshot();
}

function isManagedQuotaError(error: unknown): boolean {
  return getUserFacingAIError(error).type === AIErrorType.QUOTA_EXHAUSTED;
}

function buildRecalledDraft(
  request: ActiveComposerRequest,
  fallbackMessage?: string,
): RecalledComposerDraft {
  const fallback = fallbackMessage?.trim()
    ? fallbackMessage
    : request.submittedText;
  return {
    message: fallback.trim() ? fallback : request.submittedText,
    attachments: request.submittedAttachments,
    noteMentions: request.submittedNoteMentions,
  };
}

function markManagedAuthPromptForError(sessionId: string, error: unknown, managed: boolean) {
  if (!managed) {
    return;
  }

  const normalized = getUserFacingAIError(error);
  if (normalized.type === AIErrorType.AUTH_ERROR) {
    requestManagedAccountSignIn(sessionId);
  }
}

async function mapWithConcurrencyLimit<T, R>(
  items: readonly T[],
  limit: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (nextIndex < items.length) {
        const index = nextIndex;
        nextIndex += 1;
        results[index] = await mapper(items[index]!, index);
      }
    },
  );

  await Promise.all(workers);
  return results;
}

async function makeTemporaryAttachmentsEphemeral(
  attachments: Attachment[],
  signal?: AbortSignal,
  onAttachmentConverted?: (index: number, attachment: Attachment) => void,
): Promise<Attachment[]> {
  const ephemeralAttachments = await mapWithConcurrencyLimit(
    attachments,
    MAX_TEMPORARY_ATTACHMENT_EPHEMERAL_CONCURRENCY,
    async (attachment, index) => {
      throwIfChatRequestAborted(signal);
      if (!isImageAttachment(attachment)) {
        return attachment;
      }
      const hasPersistentReference =
        !!attachment.path ||
        isStoredAttachmentSrc(attachment.previewUrl) ||
        isStoredAttachmentSrc(attachment.assetUrl);

      if (!hasPersistentReference) {
        return attachment;
      }

      let previewUrl: string | null = null;
      try {
        previewUrl = await convertToBase64(attachment, {
          allowPath: isAllowedChatImageAttachmentPath,
        });
      } catch {
      }
      throwIfChatRequestAborted(signal);

      if (!previewUrl) {
        return null;
      }

      const ephemeralAttachment = {
        ...attachment,
        path: '',
        assetUrl: '',
        previewUrl,
      };
      onAttachmentConverted?.(index, ephemeralAttachment);
      await deleteAttachment(attachment);
      return ephemeralAttachment;
    },
  );

  return ephemeralAttachments.filter((attachment): attachment is Attachment => attachment !== null);
}

export function useChatService() {
  const { t } = useI18n();
  const { generateAutoTitle } = useAutoTitle();
  const activeComposerRequestRef = useRef<ActiveComposerRequest | null>(null);
  const recalledDraftSequenceRef = useRef(0);
  const [recalledComposerDraft, setRecalledComposerDraft] = useState<PendingRecalledComposerDraft | null>(null);
  const currentSessionId = useAIUIStore((state) => state.currentSessionId);
  const messages = useUnifiedStore((state) => {
    if (!currentSessionId) {
      return EMPTY_MESSAGES;
    }

    return state.data.ai?.messages?.[currentSessionId] || EMPTY_MESSAGES;
  });
  const providers = useUnifiedStore((state) => state.data.ai?.providers || EMPTY_PROVIDERS);
  const models = useUnifiedStore((state) => state.data.ai?.models || EMPTY_MODELS);
  const selectedModelId = useUnifiedStore((state) => state.data.ai?.selectedModelId || null);
  const customSystemPrompt = useUnifiedStore((state) => state.data.ai?.customSystemPrompt || '');
  const includeTimeContext = useUnifiedStore((state) => state.data.ai?.includeTimeContext !== false);
  const webSearchEnabled = useUnifiedStore((state) => state.data.ai?.webSearchEnabled === true);
  const isAccountConnected = useAccountSessionStore((state) => state.isConnected);
  const setSessionLoading = useAIUIStore((state) => state.setSessionLoading);
  const markSessionUnread = useAIUIStore((state) => state.markSessionUnread);
  const setError = useAIUIStore((state) => state.setError);

  const selectedModel = useMemo(() => {
    if (!selectedModelId) {
      return undefined;
    }

    const model = models.find((item) => item.id === selectedModelId);
    if (!model) {
      return undefined;
    }

    const provider = providers.find((item) => item.id === model.providerId);
    return provider?.enabled === false ? undefined : model;
  }, [models, providers, selectedModelId]);

  const clearActiveComposerRequest = useCallback((request: ActiveComposerRequest | null) => {
    if (request && activeComposerRequestRef.current !== request) {
      return;
    }
    activeComposerRequestRef.current = null;
  }, []);

  const publishRecalledComposerDraft = useCallback((draft: RecalledComposerDraft) => {
    recalledDraftSequenceRef.current += 1;
    setRecalledComposerDraft({
      ...draft,
      id: recalledDraftSequenceRef.current,
    });
  }, []);

  const clearRecalledComposerDraft = useCallback((id?: number) => {
    setRecalledComposerDraft((current) => {
      if (!current) {
        return null;
      }
      return id == null || current.id === id ? null : current;
    });
  }, []);

  const handleManagedQuotaErrorForComposer = useCallback((
    request: ActiveComposerRequest,
    error: unknown,
  ): boolean => {
    if (!isManagedQuotaError(error)) {
      return false;
    }

    markManagedQuotaExhausted();
    setError(null);
    const recalledFromStore = request.userMessageId
      ? aiActions.retractPendingUserRequest(
          request.sessionId,
          request.userMessageId,
          request.assistantMessageId,
        )
      : null;
    if (request.userMessageId && recalledFromStore === null) {
      if (request.assistantMessageId) {
        aiActions.completeMessage(request.sessionId, request.assistantMessageId);
      }
      clearActiveComposerRequest(request);
      return true;
    }

    const recalledDraft = buildRecalledDraft(request, recalledFromStore ?? undefined);
    if (
      recalledFromStore !== null ||
      recalledDraft.message.trim() ||
      recalledDraft.attachments.length > 0 ||
      recalledDraft.noteMentions.length > 0
    ) {
      publishRecalledComposerDraft(recalledDraft);
    }
    clearActiveComposerRequest(request);
    return true;
  }, [clearActiveComposerRequest, publishRecalledComposerDraft, setError]);

  const handleManagedQuotaErrorForVersionRollback = useCallback((
    sessionId: string,
    messageId: string,
    previousVersionIndex: number,
    error: unknown,
  ): boolean => {
    if (!isManagedQuotaError(error)) {
      return false;
    }

    markManagedQuotaExhausted();
    setError(null);
    aiActions.switchMessageVersion(sessionId, messageId, Math.max(0, previousVersionIndex));
    return true;
  }, [setError]);

  const stop = useCallback(() => {
    const sessionId = useAIUIStore.getState().currentSessionId;
    if (!sessionId) {
      return;
    }
    const activeComposerRequest = activeComposerRequestRef.current;
    const shouldClearComposerRequest =
      !!activeComposerRequest &&
      resolveSessionIdAlias(activeComposerRequest.sessionId) === resolveSessionIdAlias(sessionId);
    requestManager.abort(sessionId);
    setSessionLoading(sessionId, false);
    if (shouldClearComposerRequest) {
      activeComposerRequestRef.current = null;
    }
  }, [setSessionLoading]);

  const stopAndRecallLastUserMessage = useCallback((fallbackMessage?: string): RecalledComposerDraft | null => {
    const sessionId = useAIUIStore.getState().currentSessionId;
    if (!sessionId) {
      return null;
    }

    const activeComposerRequest = activeComposerRequestRef.current;
    const resolvedComposerSessionId = activeComposerRequest
      ? resolveSessionIdAlias(activeComposerRequest.sessionId)
      : null;
    const isSameComposerSession =
      !!activeComposerRequest &&
      resolvedComposerSessionId === resolveSessionIdAlias(sessionId);
    const canRecallActiveRequest =
      isSameComposerSession &&
      requestManager.isCurrent(activeComposerRequest.sessionId, activeComposerRequest.controller);

    requestManager.abort(sessionId);
    setSessionLoading(sessionId, false);

    if (!canRecallActiveRequest || !activeComposerRequest) {
      if (isSameComposerSession) {
        clearActiveComposerRequest(activeComposerRequest);
      }
      return null;
    }

    const recalledFromStore = activeComposerRequest.userMessageId
      ? aiActions.retractPendingUserRequest(
          resolvedComposerSessionId || activeComposerRequest.sessionId,
          activeComposerRequest.userMessageId,
          activeComposerRequest.assistantMessageId,
        )
      : null;
    clearActiveComposerRequest(activeComposerRequest);

    const recalledDraft = buildRecalledDraft(activeComposerRequest, fallbackMessage);

    if (recalledFromStore !== null) {
      return recalledDraft;
    }

    if (
      !activeComposerRequest.userMessageId &&
      (recalledDraft.message.trim() ||
        recalledDraft.attachments.length > 0 ||
        recalledDraft.noteMentions.length > 0)
    ) {
      return recalledDraft;
    }

    return null;
  }, [clearActiveComposerRequest, setSessionLoading]);

  const maybeGenerateAutoTitle = useCallback(
    (sessionId: string, providerId: string, modelId: string) => {
      const resolvedSessionId = resolveSessionIdAlias(sessionId);
      const session = useUnifiedStore.getState().data.ai?.sessions.find((item) => item.id === resolvedSessionId);
      if (isTemporarySessionId(resolvedSessionId) || isTemporarySession(session)) {
        return;
      }
      if (!session || !needsAutoTitle(session.title)) {
        return;
      }
      void generateAutoTitle(resolvedSessionId, providerId, modelId);
    },
    [generateAutoTitle],
  );

  const sendMessage = useCallback(
    async (text: string, attachments: Attachment[], noteMentions: NoteMentionReference[] = []) => {
      const limitedText = limitChatComposerText(text);
      const isTextEmpty = !limitedText || limitedText.trim().length === 0;
      const normalizedAttachments = limitChatMessageAttachments(attachments || []);
      const hasNoAttachments = normalizedAttachments.length === 0;
      const normalizedMentions = normalizeNoteMentions(noteMentions);
      const hasNoMentions = normalizedMentions.length === 0;

      if ((isTextEmpty && hasNoAttachments && hasNoMentions) || !selectedModel) {
        return false;
      }

      const provider = providers.find((item) => item.id === selectedModel.providerId);
      if (!provider) {
        setError(t('chat.error.providerNotFound'));
        return false;
      }
      if (provider.enabled === false) {
        setError(t('chat.error.channelOff'));
        return false;
      }
      const normalizedInput = limitChatComposerText(limitedText
        .replace(INVISIBLE_BREAK_REGEX, '')
        .replace(UNIVERSAL_NEWLINE_REGEX, '\n'));
      const userMessageText = normalizedInput.trim();
      const mentionText = normalizedMentions.map((mention) => `@${mention.title}`).join(' ');
      const unsupportedAttachments = normalizedAttachments.filter((attachment) =>
        !isImageAttachment(attachment) && !isTextAttachment(attachment)
      );
      if (unsupportedAttachments.length > 0) {
        const { message } = buildChatErrorPayload({
          message: 'UNSUPPORTED_MODEL_INPUT',
          errorCode: 'unsupported_message_content',
          statusCode: 400,
        });
        setError(message);
        return false;
      }
      if (isManagedProviderId(provider.id) && !isAccountConnected) {
        setError(null);
        requestManagedAccountSignIn(currentSessionId);
        return false;
      }
      if (await shouldBlockManagedRequestAfterBudgetRefresh(provider.id)) {
        markManagedQuotaExhausted();
        setError(null);
        return false;
      }

      let activeSessionId = currentSessionId;
      if (!activeSessionId) {
        activeSessionId = aiActions.createSession('');
      }
      if (!activeSessionId) {
        return false;
      }

      const targetSessionId = activeSessionId;
      const requestStartedAt = Date.now();
      const requestController = requestManager.start(targetSessionId);
      const composerRequest: ActiveComposerRequest = {
        sessionId: targetSessionId,
        controller: requestController,
        submittedText: userMessageText,
        submittedAttachments: normalizedAttachments,
        submittedNoteMentions: normalizedMentions,
        userMessageId: null,
        assistantMessageId: null,
      };
      activeComposerRequestRef.current = composerRequest;
      const ensureRequestActive = () => {
        if (isChatRequestCancelled(targetSessionId, requestController)) {
          throw new DOMException('Aborted', 'AbortError');
        }
      };
      setSessionLoading(targetSessionId, true);
      setError(null);
      addChatDebugLog('chat', 'sendMessage accepted', {
        sessionId: targetSessionId,
        modelId: selectedModel.id,
        providerId: provider.id,
        webSearchEnabled,
        textLength: userMessageText.length,
        attachments: normalizedAttachments.length,
        mentions: normalizedMentions.length,
      });

      void runWithSessionMutationLock(targetSessionId, async () => {
        ensureRequestActive();
        const latestMessages = await hydrateSessionMessagesFromDisk(targetSessionId);
        ensureRequestActive();
        const targetSession = useUnifiedStore.getState().data.ai?.sessions.find((item) => item.id === targetSessionId);
        const isTemporaryTarget =
          isTemporarySessionId(targetSessionId) || isTemporarySession(targetSession);
        const requestAttachments = isTemporaryTarget
          ? await makeTemporaryAttachmentsEphemeral(
              normalizedAttachments,
              requestController.signal,
              (index, attachment) => {
                const nextAttachments = [...composerRequest.submittedAttachments];
                if (nextAttachments[index]) {
                  nextAttachments[index] = attachment;
                  composerRequest.submittedAttachments = nextAttachments;
                }
              },
            )
          : normalizedAttachments;
        composerRequest.submittedAttachments = requestAttachments;
        ensureRequestActive();

        let storageContent = userMessageText;
        let messageImageSources: string[] = [];
        if (requestAttachments.length > 0) {
          const [builtImages, fileAttachmentContext] = await Promise.all([
            buildMessageImageSources(requestAttachments),
            buildMessageFileAttachmentContext(requestAttachments),
          ]);
          ensureRequestActive();
          const imageMarkdown = builtImages.content;
          messageImageSources = builtImages.imageSources;
          storageContent = [
            imageMarkdown,
            fileAttachmentContext,
            userMessageText,
          ].filter((part) => part.trim()).join('\n\n');
        }

        if (!storageContent.trim() && normalizedMentions.length > 0) {
          storageContent = mentionText;
        }

        if (!storageContent.trim()) {
          clearActiveComposerRequest(composerRequest);
          finishPreStartedChatRequest(targetSessionId, requestController, setSessionLoading);
          return;
        }

        const userMessageId = aiActions.addMessage({
          role: 'user',
          content: storageContent,
          imageSources: messageImageSources,
          modelId: selectedModel.id,
        }, targetSessionId);
        if (!userMessageId) {
          clearActiveComposerRequest(composerRequest);
          finishPreStartedChatRequest(targetSessionId, requestController, setSessionLoading);
          return;
        }
        composerRequest.userMessageId = userMessageId;

        const assistantMessageId = aiActions.addMessage({
          role: 'assistant',
          content: '',
          modelId: selectedModel.id,
        }, targetSessionId, {
          persistUnified: false,
          touchSession: false,
        });
        if (!assistantMessageId) {
          clearActiveComposerRequest(composerRequest);
          finishPreStartedChatRequest(targetSessionId, requestController, setSessionLoading);
          return;
        }
        composerRequest.assistantMessageId = assistantMessageId;

        ensureRequestActive();

        const timezoneOffset = useUnifiedStore.getState().data.settings.timezone.offset;
        const requestHistory = buildRequestHistory({
          history: latestMessages,
          modelId: selectedModel.id,
          timezoneOffset,
          includeTimeContext,
          customSystemPrompt,
        });

        void runStreamedAssistantMessage({
          sessionId: targetSessionId,
          assistantMessageId,
          controller: requestController,
          execute: async (onChunk, signal, { isActiveRequest }) => {
            throwIfChatRequestAborted(signal);
            const mentionedNotes = await loadMentionedNotes(normalizedMentions);
            throwIfChatRequestAborted(signal);
            const mentionedFolderImages = await loadMentionedFolderImageAttachments(normalizedMentions);
            throwIfChatRequestAborted(signal);
            const notesContext = buildMentionedNotesContext(mentionedNotes);
            const fileAttachmentContext = await buildMessageFileAttachmentContext(requestAttachments);
            throwIfChatRequestAborted(signal);
            const requestText = [
              fileAttachmentContext,
              userMessageText,
            ].filter((part) => part.trim()).join('\n\n');
            const textPayload = notesContext
              ? requestText
                ? `${notesContext}\n\nUser request:\n${requestText}`
                : `${notesContext}\n\nUser request: (none)`
              : requestText;

            let apiMessageContent: ChatMessageContent = textPayload;
            const apiAttachments = limitChatMessageImageAttachments([
              ...requestAttachments.filter(isImageAttachment),
              ...mentionedFolderImages,
            ]);
            if (apiAttachments.length > 0) {
              const parts: ChatMessageContentPart[] = [];
              if (textPayload) {
                parts.push({ type: 'text', text: textPayload });
              }
              for (const attachment of apiAttachments) {
                throwIfChatRequestAborted(signal);
                const imagePart = await normalizeVisionAttachment(attachment);
                throwIfChatRequestAborted(signal);
                if (imagePart) {
                  parts.push(imagePart);
                }
              }
              if (parts.length > 0) {
                apiMessageContent = parts;
              }
            }

            return await sendMessageWithEndpointFallback({
              content: apiMessageContent,
              history: requestHistory,
              model: selectedModel,
              provider,
              onChunk,
              signal,
              options: {
                webSearchEnabled,
                onWebSearchStatus: (status) => {
                  if (!isActiveRequest()) {
                    return;
                  }
                  addChatDebugLog('web-search', `status:${status.phase}`, {
                    sessionId: targetSessionId,
                    query: status.query,
                    urls: status.urls,
                    resultCount: status.results?.length,
                    metrics: status.metrics,
                    message: status.message,
                  }, status.phase === 'error' ? 'warn' : 'info');
                },
                onApiTranscript: (apiTranscript) => {
                  if (!isActiveRequest()) {
                    return;
                  }
                  addChatDebugLog('chat', 'api transcript updated', {
                    sessionId: targetSessionId,
                    messageId: assistantMessageId,
                    transcriptMessages: apiTranscript.length,
                  });
                  aiActions.updateMessageApiTranscript(targetSessionId, assistantMessageId, apiTranscript);
                },
              },
            });
          },
          updateMessage: aiActions.updateMessage,
          completeMessage: aiActions.completeMessage,
          setSessionLoading,
          setError,
          buildErrorPayload: (error) => {
            const isManaged = isManagedProviderId(provider.id);
            markManagedAuthPromptForError(targetSessionId, error, isManaged);
            return buildChatErrorPayload(error, isManaged);
          },
          handleError: (error) => {
            if (!isManagedProviderId(provider.id)) {
              return false;
            }
            return handleManagedQuotaErrorForComposer(composerRequest, error);
          },
          createEmptyResponseError: () => createEmptyResponseError(provider.id),
          onSuccess: ({ resolvedSessionId }) => {
            const completionSessionId = resolvedSessionId;
            const completionSession = useUnifiedStore
              .getState()
              .data.ai?.sessions.find((session) => session.id === completionSessionId);
            const isPersistentCompletion =
              !!completionSession &&
              !isTemporarySessionId(completionSessionId) &&
              !isTemporarySession(completionSession);

            addChatDebugLog('chat', 'sendMessage completed', {
              sessionId: completionSessionId,
              originalSessionId: targetSessionId,
              messageId: assistantMessageId,
              durationMs: Date.now() - requestStartedAt,
            });
            refreshManagedBudgetIfNeeded(provider.id);
            if (isPersistentCompletion) {
              maybeGenerateAutoTitle(completionSessionId, provider.id, selectedModel.id);
            }

            const current = useAIUIStore.getState().currentSessionId;
            if (completionSessionId !== current && isPersistentCompletion) {
              markSessionUnread(completionSessionId);
            }
          },
        }).then((status) => {
          if (status === 'aborted') {
            addChatDebugLog('chat', 'sendMessage aborted', {
              sessionId: targetSessionId,
              messageId: assistantMessageId,
              durationMs: Date.now() - requestStartedAt,
            }, 'warn');
          }
          clearActiveComposerRequest(composerRequest);
          return status;
        }).catch((error) => {
          if (isChatRequestCancelled(targetSessionId, requestController)) {
            clearActiveComposerRequest(composerRequest);
            return 'aborted' as const;
          }
          addChatDebugLog('chat', 'sendMessage stream runner failed unexpectedly', {
            sessionId: targetSessionId,
            durationMs: Date.now() - requestStartedAt,
            error: extractRawErrorMessage(error),
          }, 'error');
          const isManaged = isManagedProviderId(provider.id);
          markManagedAuthPromptForError(targetSessionId, error, isManaged);
          const { message, xml } = buildChatErrorPayload(error, isManaged);
          setError(message);
          aiActions.updateMessage(targetSessionId, assistantMessageId, xml);
          aiActions.completeMessage(targetSessionId, assistantMessageId);
          clearActiveComposerRequest(composerRequest);
          return 'failed' as const;
        });
      }).catch((error) => {
        const cancelled = isChatRequestCancelled(targetSessionId, requestController);
        finishPreStartedChatRequest(targetSessionId, requestController, setSessionLoading);
        clearActiveComposerRequest(composerRequest);
        if (cancelled) {
          addChatDebugLog('chat', 'sendMessage aborted before stream start', {
            sessionId: targetSessionId,
            durationMs: Date.now() - requestStartedAt,
          }, 'warn');
          return;
        }
        addChatDebugLog('chat', 'sendMessage mutation failed', {
          sessionId: targetSessionId,
          durationMs: Date.now() - requestStartedAt,
          error: extractRawErrorMessage(error),
        }, 'error');
        const isManaged = isManagedProviderId(provider.id);
        markManagedAuthPromptForError(targetSessionId, error, isManaged);
        const { message } = buildChatErrorPayload(error, isManaged);
        setError(message);
      });
      return true;
    },
    [
      currentSessionId,
      selectedModel,
      providers,
      customSystemPrompt,
      includeTimeContext,
      webSearchEnabled,
      setSessionLoading,
      setError,
      clearActiveComposerRequest,
      handleManagedQuotaErrorForComposer,
      maybeGenerateAutoTitle,
      markSessionUnread,
      isAccountConnected,
      t,
    ],
  );

  const editMessage = useCallback(
    async (messageId: string, newContent: string) => {
      if (!currentSessionId || !selectedModel) {
        return;
      }

      const sessionId = currentSessionId;
      const provider = providers.find((item) => item.id === selectedModel.providerId);
      if (!provider) {
        return;
      }
      if (provider.enabled === false) {
        setError(t('chat.error.channelOff'));
        return;
      }
      if (isManagedProviderId(provider.id) && !isAccountConnected) {
        setError(null);
        requestManagedAccountSignIn(sessionId);
        return;
      }
      if (await shouldBlockManagedRequestAfterBudgetRefresh(provider.id)) {
        markManagedQuotaExhausted();
        setError(null);
        return;
      }

      const requestStartedAt = Date.now();
      const requestController = requestManager.start(sessionId);
      const ensureRequestActive = () => {
        if (isChatRequestCancelled(sessionId, requestController)) {
          throw new DOMException('Aborted', 'AbortError');
        }
      };
      setSessionLoading(sessionId, true);
      setError(null);

      void runWithSessionMutationLock(sessionId, async () => {
        ensureRequestActive();
        const initialMessages = await hydrateSessionMessagesFromDisk(sessionId);
        ensureRequestActive();
        const targetMessageBeforeEdit = initialMessages.find((message) => message.id === messageId);
        if (!targetMessageBeforeEdit) {
          finishPreStartedChatRequest(sessionId, requestController, setSessionLoading);
          return;
        }
        const previousVersionIndex = typeof targetMessageBeforeEdit.currentVersionIndex === 'number'
          ? targetMessageBeforeEdit.currentVersionIndex
          : 0;

        aiActions.editMessageAndBranch(sessionId, messageId, newContent);

        const assistantMessageId = aiActions.addMessage({
          role: 'assistant',
          content: '',
          modelId: selectedModel.id,
        }, sessionId, {
          persistUnified: false,
          touchSession: false,
        });
        if (!assistantMessageId) {
          finishPreStartedChatRequest(sessionId, requestController, setSessionLoading);
          return;
        }

        addChatDebugLog('chat', 'edit resend started', {
          sessionId,
          messageId,
          modelId: selectedModel.id,
          providerId: provider.id,
          webSearchEnabled,
        });
        const state = useUnifiedStore.getState();
        const sessionMessages = state.data.ai?.messages[sessionId] || [];

        const userMsgIndex = sessionMessages.findIndex((message) => message.id === messageId);
        if (userMsgIndex === -1) {
          finishPreStartedChatRequest(sessionId, requestController, setSessionLoading);
          return;
        }

        const history = sessionMessages.slice(0, userMsgIndex);
        const timezoneOffset = useUnifiedStore.getState().data.settings.timezone.offset;
        const requestHistory = buildRequestHistory({
          history,
          modelId: selectedModel.id,
          timezoneOffset,
          includeTimeContext,
          customSystemPrompt,
        });
        ensureRequestActive();

        void runStreamedAssistantMessage({
          sessionId,
          assistantMessageId,
          controller: requestController,
          execute: async (onChunk, signal, { isActiveRequest }) => {
            throwIfChatRequestAborted(signal);
            const apiMessageContent = await buildStoredUserMessageContent(newContent);
            throwIfChatRequestAborted(signal);
            return await sendMessageWithEndpointFallback({
              content: apiMessageContent,
              history: requestHistory,
              model: selectedModel,
              provider,
              onChunk,
              signal,
              options: {
                webSearchEnabled,
                onWebSearchStatus: (status) => {
                  if (!isActiveRequest()) {
                    return;
                  }
                  addChatDebugLog('web-search', `status:${status.phase}`, {
                    sessionId,
                    query: status.query,
                    urls: status.urls,
                    resultCount: status.results?.length,
                    metrics: status.metrics,
                    message: status.message,
                  }, status.phase === 'error' ? 'warn' : 'info');
                },
                onApiTranscript: (apiTranscript) => {
                  if (!isActiveRequest()) {
                    return;
                  }
                  aiActions.updateMessageApiTranscript(sessionId, assistantMessageId, apiTranscript);
                },
              },
            });
          },
          updateMessage: aiActions.updateMessage,
          completeMessage: aiActions.completeMessage,
          setSessionLoading,
          setError,
          buildErrorPayload: (error) => {
            const isManaged = isManagedProviderId(provider.id);
            markManagedAuthPromptForError(sessionId, error, isManaged);
            return buildChatErrorPayload(error, isManaged);
          },
          handleError: (error) => {
            if (!isManagedProviderId(provider.id)) {
              return false;
            }
            return handleManagedQuotaErrorForVersionRollback(sessionId, messageId, previousVersionIndex, error);
          },
          createEmptyResponseError: () => createEmptyResponseError(provider.id),
          onSuccess: ({ resolvedSessionId }) => {
            addChatDebugLog('chat', 'edit resend completed', {
              sessionId: resolvedSessionId,
              originalSessionId: sessionId,
              assistantMessageId,
              durationMs: Date.now() - requestStartedAt,
            });
            refreshManagedBudgetIfNeeded(provider.id);
            maybeGenerateAutoTitle(resolvedSessionId, provider.id, selectedModel.id);
          },
        }).then((status) => {
          if (status === 'aborted') {
            addChatDebugLog('chat', 'edit resend aborted', {
              sessionId,
              assistantMessageId,
              durationMs: Date.now() - requestStartedAt,
            }, 'warn');
          }
          return status;
        }).catch((error) => {
          if (isChatRequestCancelled(sessionId, requestController)) {
            return 'aborted' as const;
          }
          addChatDebugLog('chat', 'edit resend stream runner failed unexpectedly', {
            sessionId,
            assistantMessageId,
            durationMs: Date.now() - requestStartedAt,
            error: extractRawErrorMessage(error),
          }, 'error');
          const isManaged = isManagedProviderId(provider.id);
          markManagedAuthPromptForError(sessionId, error, isManaged);
          const { message, xml } = buildChatErrorPayload(error, isManaged);
          setError(message);
          aiActions.updateMessage(sessionId, assistantMessageId, xml);
          aiActions.completeMessage(sessionId, assistantMessageId);
          return 'failed' as const;
        });
      }).catch((error) => {
        const cancelled = isChatRequestCancelled(sessionId, requestController);
        finishPreStartedChatRequest(sessionId, requestController, setSessionLoading);
        if (cancelled) {
          addChatDebugLog('chat', 'edit resend aborted before stream start', {
            sessionId,
            messageId,
            durationMs: Date.now() - requestStartedAt,
          }, 'warn');
          return;
        }
        addChatDebugLog('chat', 'edit resend mutation failed', {
          sessionId,
          messageId,
          error: extractRawErrorMessage(error),
        }, 'error');
        const isManaged = isManagedProviderId(provider.id);
        markManagedAuthPromptForError(sessionId, error, isManaged);
        const { message } = buildChatErrorPayload(error, isManaged);
        setError(message);
      });
    },
    [
      currentSessionId,
      selectedModel,
      providers,
      customSystemPrompt,
      includeTimeContext,
      webSearchEnabled,
      setError,
      setSessionLoading,
      maybeGenerateAutoTitle,
      handleManagedQuotaErrorForVersionRollback,
      isAccountConnected,
      t,
    ],
  );

  const regenerate = useCallback(
    async (messageId: string) => {
      if (!selectedModel || !currentSessionId) {
        return;
      }

      const sessionId = currentSessionId;
      const provider = providers.find((item) => item.id === selectedModel.providerId);
      if (!provider) {
        return;
      }
      if (provider.enabled === false) {
        setError(t('chat.error.channelOff'));
        return;
      }
      if (isManagedProviderId(provider.id) && !isAccountConnected) {
        setError(null);
        requestManagedAccountSignIn(sessionId);
        return;
      }
      if (await shouldBlockManagedRequestAfterBudgetRefresh(provider.id)) {
        markManagedQuotaExhausted();
        setError(null);
        return;
      }

      const requestStartedAt = Date.now();
      const requestController = requestManager.start(sessionId);
      const ensureRequestActive = () => {
        if (isChatRequestCancelled(sessionId, requestController)) {
          throw new DOMException('Aborted', 'AbortError');
        }
      };
      setSessionLoading(sessionId, true);
      setError(null);

      void runWithSessionMutationLock(sessionId, async () => {
        ensureRequestActive();
        const latestMessages = await hydrateSessionMessagesFromDisk(sessionId);
        ensureRequestActive();
        const messageIndex = latestMessages.findIndex((message) => message.id === messageId);
        if (messageIndex <= 0) {
          finishPreStartedChatRequest(sessionId, requestController, setSessionLoading);
          return;
        }

        const promptMessage = latestMessages[messageIndex - 1];
        if (promptMessage.role !== 'user') {
          finishPreStartedChatRequest(sessionId, requestController, setSessionLoading);
          return;
        }

        const targetMessageBeforeRegenerate = latestMessages[messageIndex];
        const previousVersionIndex = typeof targetMessageBeforeRegenerate.currentVersionIndex === 'number'
          ? targetMessageBeforeRegenerate.currentVersionIndex
          : 0;
        const history = latestMessages.slice(0, messageIndex - 1);

        aiActions.addVersion(messageId, sessionId);

        addChatDebugLog('chat', 'regenerate started', {
          sessionId,
          messageId,
          modelId: selectedModel.id,
          providerId: provider.id,
          webSearchEnabled,
        });
        const timezoneOffset = useUnifiedStore.getState().data.settings.timezone.offset;
        const requestHistory = buildRequestHistory({
          history,
          modelId: selectedModel.id,
          timezoneOffset,
          includeTimeContext,
          customSystemPrompt,
        });
        ensureRequestActive();

        void runStreamedAssistantMessage({
          sessionId,
          assistantMessageId: messageId,
          controller: requestController,
          execute: async (onChunk, signal, { isActiveRequest }) => {
            throwIfChatRequestAborted(signal);
            const apiMessageContent = await buildStoredUserMessageContent(promptMessage.content);
            throwIfChatRequestAborted(signal);
            return await sendMessageWithEndpointFallback({
              content: apiMessageContent,
              history: requestHistory,
              model: selectedModel,
              provider,
              onChunk,
              signal,
              options: {
                webSearchEnabled,
                onWebSearchStatus: (status) => {
                  if (!isActiveRequest()) {
                    return;
                  }
                  addChatDebugLog('web-search', `status:${status.phase}`, {
                    sessionId,
                    query: status.query,
                    urls: status.urls,
                    resultCount: status.results?.length,
                    metrics: status.metrics,
                    message: status.message,
                  }, status.phase === 'error' ? 'warn' : 'info');
                },
                onApiTranscript: (apiTranscript) => {
                  if (!isActiveRequest()) {
                    return;
                  }
                  aiActions.updateMessageApiTranscript(sessionId, messageId, apiTranscript);
                },
              },
            });
          },
          updateMessage: aiActions.updateMessage,
          completeMessage: aiActions.completeMessage,
          setSessionLoading,
          setError,
          buildErrorPayload: (error) => {
            const isManaged = isManagedProviderId(provider.id);
            markManagedAuthPromptForError(sessionId, error, isManaged);
            return buildChatErrorPayload(error, isManaged);
          },
          handleError: (error) => {
            if (!isManagedProviderId(provider.id)) {
              return false;
            }
            return handleManagedQuotaErrorForVersionRollback(sessionId, messageId, previousVersionIndex, error);
          },
          createEmptyResponseError: () => createEmptyResponseError(provider.id),
          onSuccess: ({ resolvedSessionId }) => {
            addChatDebugLog('chat', 'regenerate completed', {
              sessionId: resolvedSessionId,
              originalSessionId: sessionId,
              messageId,
              durationMs: Date.now() - requestStartedAt,
            });
            refreshManagedBudgetIfNeeded(provider.id);
            maybeGenerateAutoTitle(resolvedSessionId, provider.id, selectedModel.id);
          },
        }).then((status) => {
          if (status === 'aborted') {
            addChatDebugLog('chat', 'regenerate aborted', {
              sessionId,
              messageId,
              durationMs: Date.now() - requestStartedAt,
            }, 'warn');
          }
          return status;
        }).catch((error) => {
          if (isChatRequestCancelled(sessionId, requestController)) {
            return 'aborted' as const;
          }
          addChatDebugLog('chat', 'regenerate stream runner failed unexpectedly', {
            sessionId,
            messageId,
            durationMs: Date.now() - requestStartedAt,
            error: extractRawErrorMessage(error),
          }, 'error');
          const isManaged = isManagedProviderId(provider.id);
          markManagedAuthPromptForError(sessionId, error, isManaged);
          const { message, xml } = buildChatErrorPayload(error, isManaged);
          setError(message);
          aiActions.updateMessage(sessionId, messageId, xml);
          aiActions.completeMessage(sessionId, messageId);
          return 'failed' as const;
        });
      }).catch((error) => {
        const cancelled = isChatRequestCancelled(sessionId, requestController);
        finishPreStartedChatRequest(sessionId, requestController, setSessionLoading);
        if (cancelled) {
          addChatDebugLog('chat', 'regenerate aborted before stream start', {
            sessionId,
            messageId,
            durationMs: Date.now() - requestStartedAt,
          }, 'warn');
          return;
        }
        addChatDebugLog('chat', 'regenerate mutation failed', {
          sessionId,
          messageId,
          error: extractRawErrorMessage(error),
        }, 'error');
        const isManaged = isManagedProviderId(provider.id);
        markManagedAuthPromptForError(sessionId, error, isManaged);
        const { message } = buildChatErrorPayload(error, isManaged);
        setError(message);
      });
    },
    [
      currentSessionId,
      selectedModel,
      providers,
      customSystemPrompt,
      includeTimeContext,
      webSearchEnabled,
      setSessionLoading,
      setError,
      maybeGenerateAutoTitle,
      handleManagedQuotaErrorForVersionRollback,
      messages,
      isAccountConnected,
      t,
    ],
  );

  const switchMessageVersion = useCallback(
    async (sessionId: string, messageId: string, versionIndex: number) => {
      if (!sessionId) {
        return;
      }

      await runWithSessionMutationLock(sessionId, async () => {
        await hydrateSessionMessagesFromDisk(sessionId);
        aiActions.switchMessageVersion(sessionId, messageId, versionIndex);
      });
    },
    [],
  );

  return {
    sendMessage,
    regenerate,
    editMessage,
    switchMessageVersion,
    stop,
    stopAndRecallLastUserMessage,
    recalledComposerDraft,
    clearRecalledComposerDraft,
  };
}
