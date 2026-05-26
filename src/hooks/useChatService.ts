import { useCallback, useMemo } from 'react';
import { actions as aiActions } from '@/stores/useAIStore';
import {
  convertToBase64,
  deleteAttachment,
  type Attachment,
} from '@/lib/storage/attachmentStorage';
import type { ChatMessageContent, ChatMessageContentPart } from '@/lib/ai/types';
import type { NoteMentionReference } from '@/lib/ai/noteMentions';
import { buildRequestHistory } from '@/lib/ai/requestContext';
import { generateId } from '@/lib/id';
import { isManagedProviderId } from '@/lib/ai/managedService';
import { useUnifiedStore } from '@/stores/unified/useUnifiedStore';
import { useAIUIStore } from '@/stores/ai/chatState';
import { useAccountSessionStore } from '@/stores/accountSession';
import { useManagedAIStore } from '@/stores/useManagedAIStore';
import { useAutoTitle } from './useAutoTitle';
import { requestManager } from '@/lib/ai/requestManager';
import { getUserFacingAIError } from '@/lib/ai/errors';
import { AIErrorType } from '@/lib/ai/types';
import {
  isTemporarySession,
  isTemporarySessionId,
  needsAutoTitle,
} from '@/lib/ai/temporaryChat';
import { runWithSessionMutationLock } from '@/lib/ai/sessionMutationLock';
import {
  buildMentionedNotesContext,
  buildMessageImageSources,
  buildStoredUserMessageContent,
  loadMentionedNotes,
  normalizeNoteMentions,
  normalizeVisionAttachment,
  refreshManagedBudgetIfNeeded,
} from './chatService/helpers';
import { runStreamedAssistantMessage } from './chatService/runStreamedAssistantMessage';
import { sendMessageWithEndpointFallback } from './chatService/sendMessageWithEndpointFallback';
import { hydrateSessionMessagesFromDisk } from '@/stores/ai/sessionConsistency';
import { translate, useI18n } from '@/lib/i18n';
import { ACCOUNT_AUTH_INVALIDATED_EVENT } from '@/lib/account/sessionEvent';
import { addChatDebugLog } from '@/lib/debug/chatDebugLog';

const INVISIBLE_BREAK_REGEX = /[\u200b\u200c\u200d\ufeff]/g;
const UNIVERSAL_NEWLINE_REGEX = /\r\n?|\u2028|\u2029|\u0085/g;
const EMPTY_MESSAGES: never[] = [];

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
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
  return String(error || '').trim() || 'AI request failed.';
}

function dispatchAccountAuthInvalidated() {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new Event(ACCOUNT_AUTH_INVALIDATED_EVENT));
}

function buildChatErrorPayload(error: unknown, managed = true) {
  if (!managed) {
    const message = extractRawErrorMessage(error);
    return {
      message,
      xml: `<error type="custom_provider" code="">${escapeXml(message)}</error>`,
    };
  }

  const normalized = getUserFacingAIError(error);
  if (normalized.type === AIErrorType.AUTH_ERROR) {
    dispatchAccountAuthInvalidated();
  }

  if (normalized.type === AIErrorType.NETWORK_ERROR) {
    const message = translate('chat.error.upstreamUnavailable');
    return {
      message,
      xml: `<error type="${escapeXml(AIErrorType.SERVER_ERROR)}" code="upstream_unavailable">${escapeXml(message)}</error>`,
    };
  }

  return {
    message: normalized.message,
    xml: `<error type="${escapeXml(normalized.type)}" code="${escapeXml(normalized.code)}">${escapeXml(normalized.message)}</error>`,
  };
}

function createEmptyResponseError(providerId: string): Error {
  return new Error(isManagedProviderId(providerId) ? 'UPSTREAM_UNAVAILABLE' : 'The model returned an empty response.');
}

const MANAGED_BUDGET_BLOCK_MAX_AGE_MS = 60_000;

function createManagedQuotaError(message: string) {
  return {
    type: 'QUOTA_EXHAUSTED',
    message,
    errorCode: 'points_exhausted',
    statusCode: 403,
  };
}

function createManagedAuthRequiredError() {
  return {
    type: AIErrorType.AUTH_ERROR,
    message: 'vlaina sign-in required',
    statusCode: 401,
  };
}

function shouldBlockManagedRequestForKnownBudget(providerId: string): boolean {
  if (!isManagedProviderId(providerId)) {
    return false;
  }

  const { budget, lastBudgetSyncAt } = useManagedAIStore.getState();
  if (!budget || !lastBudgetSyncAt || Date.now() - lastBudgetSyncAt > MANAGED_BUDGET_BLOCK_MAX_AGE_MS) {
    return false;
  }

  const remainingPercent = Number(budget.remainingPercent);
  return (
    budget.active === false ||
    budget.status === 'exhausted' ||
    (Number.isFinite(remainingPercent) && remainingPercent <= 0)
  );
}

function writeManagedQuotaErrorMessage(
  sessionId: string,
  assistantMessageId: string,
  setError: (error: string | null) => void,
  message: string,
) {
  const { message: errorMessage, xml } = buildChatErrorPayload(createManagedQuotaError(message));
  setError(errorMessage);
  aiActions.updateMessage(sessionId, assistantMessageId, xml);
  aiActions.completeMessage(sessionId, assistantMessageId);
}

function writeManagedAuthRequiredMessage(
  sessionId: string,
  assistantMessageId: string,
  setError: (error: string | null) => void,
) {
  const error = createManagedAuthRequiredError();
  markManagedAuthPromptForError(sessionId, error, true);
  const { message, xml } = buildChatErrorPayload(error, true);
  setError(message);
  aiActions.updateMessage(sessionId, assistantMessageId, xml);
  aiActions.completeMessage(sessionId, assistantMessageId);
}

function markManagedAuthPromptForError(sessionId: string, error: unknown, managed: boolean) {
  if (!managed) {
    return;
  }

  const normalized = getUserFacingAIError(error);
  if (normalized.type === AIErrorType.AUTH_ERROR) {
    useAIUIStore.getState().setAuthPromptSessionId(sessionId);
  }
}

async function makeTemporaryAttachmentsEphemeral(attachments: Attachment[]): Promise<Attachment[]> {
  return await Promise.all(
    attachments.map(async (attachment) => {
      const hasPersistentReference =
        !!attachment.path ||
        attachment.previewUrl.startsWith('attachment://') ||
        attachment.previewUrl.startsWith('app-file://attachment/') ||
        attachment.assetUrl.startsWith('attachment://') ||
        attachment.assetUrl.startsWith('app-file://attachment/') ||
        (attachment.assetUrl.startsWith('file:') && attachment.assetUrl.includes('/attachments/'));

      if (!hasPersistentReference) {
        return attachment;
      }

      let previewUrl: string | null = null;
      try {
        previewUrl = await convertToBase64(attachment);
      } catch {
      }

      if (!previewUrl) {
        return attachment;
      }

      await deleteAttachment(attachment);
      return {
        ...attachment,
        path: '',
        assetUrl: '',
        previewUrl,
      };
    })
  );
}

export function useChatService() {
  const { t } = useI18n();
  const { generateAutoTitle } = useAutoTitle();
  const currentSessionId = useAIUIStore((state) => state.currentSessionId);
  const messages = useUnifiedStore((state) => {
    if (!currentSessionId) {
      return EMPTY_MESSAGES;
    }

    return state.data.ai?.messages?.[currentSessionId] || EMPTY_MESSAGES;
  });
  const providers = useUnifiedStore((state) => state.data.ai?.providers || []);
  const models = useUnifiedStore((state) => state.data.ai?.models || []);
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

  const stop = useCallback(() => {
    const sessionId = useAIUIStore.getState().currentSessionId;
    if (!sessionId) {
      return;
    }
    requestManager.abort(sessionId);
    setSessionLoading(sessionId, false);
  }, [setSessionLoading]);

  const maybeGenerateAutoTitle = useCallback(
    (sessionId: string, providerId: string, modelId: string) => {
      const session = useUnifiedStore.getState().data.ai?.sessions.find((item) => item.id === sessionId);
      if (isTemporarySessionId(sessionId) || isTemporarySession(session)) {
        return;
      }
      if (!session || !needsAutoTitle(session.title)) {
        return;
      }
      void generateAutoTitle(sessionId, providerId, modelId);
    },
    [generateAutoTitle],
  );

  const sendMessage = useCallback(
    async (text: string, attachments: Attachment[], noteMentions: NoteMentionReference[] = []) => {
      const isTextEmpty = !text || text.trim().length === 0;
      const hasNoAttachments = !attachments || attachments.length === 0;
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
      const normalizedInput = text
        .replace(INVISIBLE_BREAK_REGEX, '')
        .replace(UNIVERSAL_NEWLINE_REGEX, '\n');
      const userMessageText = normalizedInput.trim();
      const mentionText = normalizedMentions.map((mention) => `@${mention.title}`).join(' ');

      let activeSessionId = currentSessionId;
      if (!activeSessionId) {
        if (isManagedProviderId(provider.id) && !isAccountConnected) {
          aiActions.toggleTemporaryChat(true);
          activeSessionId = useAIUIStore.getState().currentSessionId;
          if (activeSessionId) {
            useAIUIStore.getState().setAuthPromptSessionId(activeSessionId);
          }
        } else {
          activeSessionId = aiActions.createSession('');
        }
      }
      if (!activeSessionId) {
        return false;
      }

      const targetSessionId = activeSessionId;
      const requestStartedAt = Date.now();
      addChatDebugLog('chat', 'sendMessage accepted', {
        sessionId: targetSessionId,
        modelId: selectedModel.id,
        providerId: provider.id,
        webSearchEnabled,
        textLength: userMessageText.length,
        attachments: attachments.length,
        mentions: normalizedMentions.length,
      });

      void runWithSessionMutationLock(targetSessionId, async () => {
        const latestMessages = await hydrateSessionMessagesFromDisk(targetSessionId);
        const targetSession = useUnifiedStore.getState().data.ai?.sessions.find((item) => item.id === targetSessionId);
        const isTemporaryTarget =
          isTemporarySessionId(targetSessionId) || isTemporarySession(targetSession);
        const requestAttachments = isTemporaryTarget
          ? await makeTemporaryAttachmentsEphemeral(attachments)
          : attachments;

        let storageContent = userMessageText;
        let messageImageSources: string[] = [];
        if (requestAttachments.length > 0) {
          const builtImages = buildMessageImageSources(requestAttachments);
          const imageMarkdown = builtImages.content;
          messageImageSources = builtImages.imageSources;
          storageContent = imageMarkdown + (userMessageText ? `\n\n${userMessageText}` : '');
        }

        if (!storageContent.trim() && normalizedMentions.length > 0) {
          storageContent = mentionText;
        }

        aiActions.addMessage({
          role: 'user',
          content: storageContent,
          imageSources: messageImageSources,
          modelId: selectedModel.id,
        }, targetSessionId);

        const assistantMessageId = generateId('msg-');
        aiActions.addMessage({
          id: assistantMessageId,
          role: 'assistant',
          content: '',
          modelId: selectedModel.id,
        }, targetSessionId, {
          persistUnified: false,
          touchSession: false,
        });

        if (shouldBlockManagedRequestForKnownBudget(provider.id)) {
          writeManagedQuotaErrorMessage(targetSessionId, assistantMessageId, setError, t('chat.error.pointsExhausted'));
          return;
        }
        if (isManagedProviderId(provider.id) && !isAccountConnected) {
          writeManagedAuthRequiredMessage(targetSessionId, assistantMessageId, setError);
          return;
        }

        try {
          const timezoneOffset = useUnifiedStore.getState().data.settings.timezone.offset;
          const requestHistory = buildRequestHistory({
            history: latestMessages,
            modelId: selectedModel.id,
            timezoneOffset,
            includeTimeContext,
            customSystemPrompt,
          });

          const mentionedNotes = await loadMentionedNotes(normalizedMentions);
          const notesContext = buildMentionedNotesContext(mentionedNotes);
          const requestText = userMessageText;
          const textPayload = notesContext
            ? requestText
              ? `${notesContext}\n\nUser request:\n${requestText}`
              : `${notesContext}\n\nUser request: (none)`
            : requestText;

          let apiMessageContent: ChatMessageContent = textPayload;
          if (requestAttachments.length > 0) {
            const parts: ChatMessageContentPart[] = [];
            if (textPayload) {
              parts.push({ type: 'text', text: textPayload });
            }
            for (const attachment of requestAttachments) {
              const imagePart = await normalizeVisionAttachment(attachment);
              if (imagePart) {
                parts.push(imagePart);
              }
            }
            if (parts.length > 0) {
              apiMessageContent = parts;
            }
          }

          await runStreamedAssistantMessage({
            sessionId: targetSessionId,
            assistantMessageId,
            execute: (onChunk, signal) =>
              sendMessageWithEndpointFallback({
                content: apiMessageContent,
                history: requestHistory,
                model: selectedModel,
                provider,
                onChunk,
                signal,
                options: {
                  webSearchEnabled,
                  onWebSearchStatus: (status) => {
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
                    addChatDebugLog('chat', 'api transcript updated', {
                      sessionId: targetSessionId,
                      messageId: assistantMessageId,
                      transcriptMessages: apiTranscript.length,
                    });
                    aiActions.updateMessageApiTranscript(targetSessionId, assistantMessageId, apiTranscript);
                  },
                },
              }),
            updateMessage: aiActions.updateMessage,
            completeMessage: aiActions.completeMessage,
            setSessionLoading,
            setError,
            buildErrorPayload: (error) => {
              const isManaged = isManagedProviderId(provider.id);
              markManagedAuthPromptForError(targetSessionId, error, isManaged);
              return buildChatErrorPayload(error, isManaged);
            },
            createEmptyResponseError: () => createEmptyResponseError(provider.id),
            onSuccess: () => {
              addChatDebugLog('chat', 'sendMessage completed', {
                sessionId: targetSessionId,
                messageId: assistantMessageId,
                durationMs: Date.now() - requestStartedAt,
              });
              refreshManagedBudgetIfNeeded(provider.id);
              if (!isTemporaryTarget) {
                maybeGenerateAutoTitle(targetSessionId, provider.id, selectedModel.id);
              }

              const current = useAIUIStore.getState().currentSessionId;
              if (targetSessionId !== current && !isTemporaryTarget) {
                markSessionUnread(targetSessionId);
              }
            },
          });
        } catch (error) {
          addChatDebugLog('chat', 'sendMessage failed before stream runner completed', {
            sessionId: targetSessionId,
            durationMs: Date.now() - requestStartedAt,
            error: error instanceof Error ? error.message : String(error),
          }, 'error');
          const isManaged = isManagedProviderId(provider.id);
          markManagedAuthPromptForError(targetSessionId, error, isManaged);
          const { message, xml } = buildChatErrorPayload(error, isManaged);
          setError(message);
          aiActions.updateMessage(targetSessionId, assistantMessageId, xml);
        }
      }).catch((error) => {
        addChatDebugLog('chat', 'sendMessage mutation failed', {
          sessionId: targetSessionId,
          durationMs: Date.now() - requestStartedAt,
          error: error instanceof Error ? error.message : String(error),
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

      await runWithSessionMutationLock(sessionId, async () => {
        const initialMessages = await hydrateSessionMessagesFromDisk(sessionId);
        if (!initialMessages.some((message) => message.id === messageId)) {
          return;
        }

        aiActions.editMessageAndBranch(sessionId, messageId, newContent);

        const assistantMessageId = generateId('msg-');
        aiActions.addMessage({
          id: assistantMessageId,
          role: 'assistant',
          content: '',
          modelId: selectedModel.id,
        }, sessionId, {
          persistUnified: false,
          touchSession: false,
        });

        if (shouldBlockManagedRequestForKnownBudget(provider.id)) {
          writeManagedQuotaErrorMessage(sessionId, assistantMessageId, setError, t('chat.error.pointsExhausted'));
          return;
        }
        if (isManagedProviderId(provider.id) && !isAccountConnected) {
          writeManagedAuthRequiredMessage(sessionId, assistantMessageId, setError);
          return;
        }

        try {
          const requestStartedAt = Date.now();
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
          const apiMessageContent = await buildStoredUserMessageContent(newContent);

          await runStreamedAssistantMessage({
            sessionId,
            assistantMessageId,
            execute: (onChunk, signal) =>
              sendMessageWithEndpointFallback({
                content: apiMessageContent,
                history: requestHistory,
                model: selectedModel,
                provider,
                onChunk,
                signal,
                options: {
                  webSearchEnabled,
                  onWebSearchStatus: (status) => {
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
                    aiActions.updateMessageApiTranscript(sessionId, assistantMessageId, apiTranscript);
                  },
                },
              }),
            updateMessage: aiActions.updateMessage,
            completeMessage: aiActions.completeMessage,
            setSessionLoading,
            setError,
            buildErrorPayload: (error) => {
              const isManaged = isManagedProviderId(provider.id);
              markManagedAuthPromptForError(sessionId, error, isManaged);
              return buildChatErrorPayload(error, isManaged);
            },
            createEmptyResponseError: () => createEmptyResponseError(provider.id),
            onSuccess: () => {
              addChatDebugLog('chat', 'edit resend completed', {
                sessionId,
                assistantMessageId,
                durationMs: Date.now() - requestStartedAt,
              });
              refreshManagedBudgetIfNeeded(provider.id);
              maybeGenerateAutoTitle(sessionId, provider.id, selectedModel.id);
            },
          });
        } catch (error) {
          const isManaged = isManagedProviderId(provider.id);
          markManagedAuthPromptForError(sessionId, error, isManaged);
          const { message, xml } = buildChatErrorPayload(error, isManaged);
          setError(message);
          aiActions.updateMessage(sessionId, assistantMessageId, xml);
        }
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
      await runWithSessionMutationLock(sessionId, async () => {
        const latestMessages = await hydrateSessionMessagesFromDisk(sessionId);
        const messageIndex = latestMessages.findIndex((message) => message.id === messageId);
        if (messageIndex <= 0) {
          return;
        }

        const promptMessage = latestMessages[messageIndex - 1];
        if (promptMessage.role !== 'user') {
          return;
        }

        const history = latestMessages.slice(0, messageIndex - 1);
        const provider = providers.find((item) => item.id === selectedModel.providerId);
        if (!provider) {
          return;
        }
        if (provider.enabled === false) {
          setError(t('chat.error.channelOff'));
          return;
        }

        aiActions.addVersion(messageId, sessionId);

        if (shouldBlockManagedRequestForKnownBudget(provider.id)) {
          writeManagedQuotaErrorMessage(sessionId, messageId, setError, t('chat.error.pointsExhausted'));
          return;
        }
        if (isManagedProviderId(provider.id) && !isAccountConnected) {
          writeManagedAuthRequiredMessage(sessionId, messageId, setError);
          return;
        }

        try {
          const requestStartedAt = Date.now();
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
          const apiMessageContent = await buildStoredUserMessageContent(promptMessage.content);

          await runStreamedAssistantMessage({
            sessionId,
            assistantMessageId: messageId,
            execute: (onChunk, signal) =>
              sendMessageWithEndpointFallback({
                content: apiMessageContent,
                history: requestHistory,
                model: selectedModel,
                provider,
                onChunk,
                signal,
                options: {
                  webSearchEnabled,
                  onWebSearchStatus: (status) => {
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
                    aiActions.updateMessageApiTranscript(sessionId, messageId, apiTranscript);
                  },
                },
              }),
            updateMessage: aiActions.updateMessage,
            completeMessage: aiActions.completeMessage,
            setSessionLoading,
            setError,
            buildErrorPayload: (error) => {
              const isManaged = isManagedProviderId(provider.id);
              markManagedAuthPromptForError(sessionId, error, isManaged);
              return buildChatErrorPayload(error, isManaged);
            },
            createEmptyResponseError: () => createEmptyResponseError(provider.id),
            onSuccess: () => {
              addChatDebugLog('chat', 'regenerate completed', {
                sessionId,
                messageId,
                durationMs: Date.now() - requestStartedAt,
              });
              refreshManagedBudgetIfNeeded(provider.id);
              maybeGenerateAutoTitle(sessionId, provider.id, selectedModel.id);
            },
          });
        } catch (error) {
          const isManaged = isManagedProviderId(provider.id);
          markManagedAuthPromptForError(sessionId, error, isManaged);
          const { message, xml } = buildChatErrorPayload(error, isManaged);
          setError(message);
          aiActions.updateMessage(sessionId, messageId, xml);
        }
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

  return { sendMessage, regenerate, editMessage, switchMessageVersion, stop };
}
