import { useCallback } from 'react';
import { useAIStore } from '@/stores/useAIStore';
import { openaiClient } from '@/lib/ai/providers/openai';
import type { Attachment } from '@/lib/storage/attachmentStorage';
import type { ChatMessageContent, ChatMessageContentPart } from '@/lib/ai/types';
import type { NoteMentionReference } from '@/lib/ai/noteMentions';
import { buildRequestHistory } from '@/lib/ai/requestContext';
import { generateId } from '@/lib/id';
import { isManagedProviderId } from '@/lib/ai/managedService';
import { useUnifiedStore } from '@/stores/unified/useUnifiedStore';
import { useAutoTitle } from './useAutoTitle';
import { requestManager } from '@/lib/ai/requestManager';
import { getUserFacingAIError } from '@/lib/ai/errors';
import { needsAutoTitle } from '@/lib/ai/temporaryChat';
import { runWithSessionMutationLock } from '@/lib/ai/sessionMutationLock';
import {
  buildMentionedNotesContext,
  buildMessageImageSources,
  loadMentionedNotes,
  normalizeNoteMentions,
  normalizeVisionAttachment,
  refreshManagedBudgetIfNeeded,
} from './chatService/helpers';
import { runStreamedAssistantMessage } from './chatService/runStreamedAssistantMessage';
import { hydrateSessionMessagesFromDisk } from '@/stores/ai/sessionConsistency';

const INVISIBLE_BREAK_REGEX = /[\u200b\u200c\u200d\ufeff]/g;
const UNIVERSAL_NEWLINE_REGEX = /\r\n?|\u2028|\u2029|\u0085/g;

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function buildChatErrorPayload(error: unknown) {
  const normalized = getUserFacingAIError(error)
  return {
    message: normalized.message,
    xml: `<error type="${escapeXml(normalized.type)}" code="${escapeXml(normalized.code)}">${escapeXml(normalized.message)}</error>`,
  }
}

export function useChatService() {
  const { generateAutoTitle } = useAutoTitle();

  const {
    currentSessionId,
    createSession,
    addMessage,
    updateMessage,
    completeMessage,
    editMessageAndBranch,
    addVersion,
    switchMessageVersion: switchMessageVersionInStore,
    getSelectedModel,
    providers,
    isTemporarySession,
    customSystemPrompt,
    includeTimeContext,
    setSessionLoading,
    markSessionUnread,
    setError,
  } = useAIStore();

  const selectedModel = getSelectedModel();

  const stop = useCallback(() => {
    const sessionId = useUnifiedStore.getState().data.ai?.currentSessionId;
    if (!sessionId) return;
    requestManager.abort(sessionId);
    setSessionLoading(sessionId, false);
  }, [setSessionLoading]);

  const maybeGenerateAutoTitle = useCallback(
    (sessionId: string, providerId: string, modelId: string) => {
      if (isTemporarySession(sessionId)) return;
      const session = useUnifiedStore.getState().data.ai?.sessions.find((item) => item.id === sessionId);
      if (!session || !needsAutoTitle(session.title)) return;
      void generateAutoTitle(sessionId, providerId, modelId);
    },
    [generateAutoTitle, isTemporarySession]
  );

  const sendMessage = useCallback(
    async (text: string, attachments: Attachment[], noteMentions: NoteMentionReference[] = []) => {
      const isTextEmpty = !text || text.trim().length === 0;
      const hasNoAttachments = !attachments || attachments.length === 0;
      const normalizedMentions = normalizeNoteMentions(noteMentions);
      const hasNoMentions = normalizedMentions.length === 0;

      if ((isTextEmpty && hasNoAttachments && hasNoMentions) || !selectedModel) return;

      const provider = providers.find((p) => p.id === selectedModel.providerId);
      if (!provider) {
        setError('Provider not found');
        return;
      }
      if (provider.enabled === false) {
        setError('This channel is turned off.');
        return;
      }
      if (isManagedProviderId(provider.id) && attachments.length > 0) {
        setError('vlaina managed chat currently supports text-only messages.');
        return;
      }

      const normalizedInput = text.replace(INVISIBLE_BREAK_REGEX, '').replace(UNIVERSAL_NEWLINE_REGEX, '\n');
      const userMessageText = normalizedInput.trim();
      const mentionText = normalizedMentions.map((mention) => `@${mention.title}`).join(' ');

      let activeSessionId = currentSessionId;
      if (!activeSessionId) {
        activeSessionId = createSession('');
      }

      const targetSessionId = activeSessionId;

      await runWithSessionMutationLock(targetSessionId, async () => {
        const latestMessages = await hydrateSessionMessagesFromDisk(targetSessionId);

        let storageContent = userMessageText;
        let messageImageSources: string[] = [];
        if (attachments.length > 0) {
          const builtImages = buildMessageImageSources(attachments);
          const imageMarkdown = builtImages.content;
          messageImageSources = builtImages.imageSources;
          storageContent = imageMarkdown + (userMessageText ? `\n\n${userMessageText}` : '');
        }

        if (!storageContent.trim() && normalizedMentions.length > 0) {
          storageContent = mentionText;
        }

        addMessage({
          role: 'user',
          content: storageContent,
          imageSources: messageImageSources,
          modelId: selectedModel.id,
        }, targetSessionId);

        const assistantMessageId = generateId('msg-');
        addMessage({
          id: assistantMessageId,
          role: 'assistant',
          content: '',
          modelId: selectedModel.id,
        }, targetSessionId);

        const isTemporaryTarget = isTemporarySession(targetSessionId);

        try {
          const timezoneOffset = useUnifiedStore.getState().data.settings.timezone.offset;
          const requestHistory = buildRequestHistory({
            history: latestMessages,
            modelId: selectedModel.id,
            timezoneOffset,
            includeTimeContext,
            customSystemPrompt
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
          if (attachments.length > 0) {
            const parts: ChatMessageContentPart[] = [];
            if (textPayload) {
              parts.push({ type: 'text', text: textPayload });
            }
            for (const att of attachments) {
              const imagePart = await normalizeVisionAttachment(att);
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
              openaiClient.sendMessage(
                apiMessageContent,
                requestHistory,
                selectedModel,
                provider,
                onChunk,
                signal
              ),
            updateMessage,
            completeMessage,
            setSessionLoading,
            setError,
            buildErrorPayload: buildChatErrorPayload,
            onSuccess: () => {
              refreshManagedBudgetIfNeeded(provider.id);
              if (!isTemporaryTarget) {
                maybeGenerateAutoTitle(targetSessionId, provider.id, selectedModel.id);
              }

              const current = useUnifiedStore.getState().data.ai?.currentSessionId;
              if (targetSessionId !== current && !isTemporarySession(targetSessionId)) {
                markSessionUnread(targetSessionId);
              }
            },
          });
        } catch (error) {
          const { message, xml } = buildChatErrorPayload(error)
          setError(message);
          updateMessage(targetSessionId, assistantMessageId, xml);
        }
      });
    },
    [
      currentSessionId,
      createSession,
      addMessage,
      updateMessage,
      completeMessage,
      selectedModel,
      providers,
      isTemporarySession,
      customSystemPrompt,
      includeTimeContext,
      setSessionLoading,
      setError,
      maybeGenerateAutoTitle,
      markSessionUnread,
    ]
  );

  const editMessage = useCallback(
    async (messageId: string, newContent: string) => {
      if (!currentSessionId || !selectedModel) return;
      const sessionId = currentSessionId;
      const provider = providers.find((p) => p.id === selectedModel.providerId);
      if (!provider) return;
      if (provider.enabled === false) {
        setError('This channel is turned off.');
        return;
      }
      await runWithSessionMutationLock(sessionId, async () => {
        const initialMessages = await hydrateSessionMessagesFromDisk(sessionId);
        if (!initialMessages.some((m) => m.id === messageId)) {
          return;
        }

        editMessageAndBranch(sessionId, messageId, newContent);

        const assistantMessageId = generateId('msg-');
        addMessage({
          id: assistantMessageId,
          role: 'assistant',
          content: '',
          modelId: selectedModel.id,
        }, sessionId);

        try {
          const state = useUnifiedStore.getState();
          const sessionMessages = state.data.ai?.messages[sessionId] || [];

          const userMsgIndex = sessionMessages.findIndex((m) => m.id === messageId);
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
            customSystemPrompt
          });

          await runStreamedAssistantMessage({
            sessionId,
            assistantMessageId,
            execute: (onChunk, signal) =>
              openaiClient.sendMessage(
                newContent,
                requestHistory,
                selectedModel,
                provider,
                onChunk,
                signal
              ),
            updateMessage,
            completeMessage,
            setSessionLoading,
            setError,
            buildErrorPayload: buildChatErrorPayload,
            onSuccess: () => {
              refreshManagedBudgetIfNeeded(provider.id);
              maybeGenerateAutoTitle(sessionId, provider.id, selectedModel.id);
            },
          });
        } catch (error) {
          const { message, xml } = buildChatErrorPayload(error)
          setError(message);
          updateMessage(sessionId, assistantMessageId, xml);
        }
      });
    },
    [
      currentSessionId,
      selectedModel,
      providers,
      customSystemPrompt,
      includeTimeContext,
      editMessageAndBranch,
      addMessage,
      updateMessage,
      completeMessage,
      setError,
      setSessionLoading,
      maybeGenerateAutoTitle,
    ]
  );

  const regenerate = useCallback(
    async (msgId: string) => {
      if (!selectedModel || !currentSessionId) return;
      const sessionId = currentSessionId;
      await runWithSessionMutationLock(sessionId, async () => {
        const latestMessages = await hydrateSessionMessagesFromDisk(sessionId);

        const msgIndex = latestMessages.findIndex((m) => m.id === msgId);
        if (msgIndex <= 0) return;

        const promptMsg = latestMessages[msgIndex - 1];
        if (promptMsg.role !== 'user') return;

        const history = latestMessages.slice(0, msgIndex - 1);
        const provider = providers.find((p) => p.id === selectedModel.providerId);
        if (!provider) return;
        if (provider.enabled === false) {
          setError('This channel is turned off.');
          return;
        }

        addVersion(msgId, sessionId);

        try {
          const timezoneOffset = useUnifiedStore.getState().data.settings.timezone.offset;
          const requestHistory = buildRequestHistory({
            history,
            modelId: selectedModel.id,
            timezoneOffset,
            includeTimeContext,
            customSystemPrompt
          });

          await runStreamedAssistantMessage({
            sessionId,
            assistantMessageId: msgId,
            execute: (onChunk, signal) =>
              openaiClient.sendMessage(
                promptMsg.content,
                requestHistory,
                selectedModel,
                provider,
                onChunk,
                signal
              ),
            updateMessage,
            completeMessage,
            setSessionLoading,
            setError,
            buildErrorPayload: buildChatErrorPayload,
            onSuccess: () => {
              refreshManagedBudgetIfNeeded(provider.id);
              maybeGenerateAutoTitle(sessionId, provider.id, selectedModel.id);
            },
          });
        } catch (error) {
          const { message, xml } = buildChatErrorPayload(error)
          setError(message);
          updateMessage(sessionId, msgId, xml);
        }
      });
    },
    [
      selectedModel,
      providers,
      customSystemPrompt,
      includeTimeContext,
      addVersion,
      setSessionLoading,
      updateMessage,
      completeMessage,
      setError,
      currentSessionId,
      maybeGenerateAutoTitle,
    ]
  );

  const switchMessageVersion = useCallback(
    async (sessionId: string, messageId: string, versionIndex: number) => {
      if (!sessionId) return;

      await runWithSessionMutationLock(sessionId, async () => {
        await hydrateSessionMessagesFromDisk(sessionId);
        switchMessageVersionInStore(sessionId, messageId, versionIndex);
      });
    },
    [switchMessageVersionInStore]
  );

  return { sendMessage, regenerate, editMessage, switchMessageVersion, stop };
}
