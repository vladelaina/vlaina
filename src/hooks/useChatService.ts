import { useCallback, useMemo } from 'react';
import { actions as aiActions } from '@/stores/useAIStore';
import { openaiClient } from '@/lib/ai/providers/openai';
import type { Attachment } from '@/lib/storage/attachmentStorage';
import type { ChatMessageContent, ChatMessageContentPart } from '@/lib/ai/types';
import type { NoteMentionReference } from '@/lib/ai/noteMentions';
import { buildRequestHistory } from '@/lib/ai/requestContext';
import { generateId } from '@/lib/id';
import { isManagedProviderId } from '@/lib/ai/managedService';
import { useUnifiedStore } from '@/stores/unified/useUnifiedStore';
import { useAIUIStore } from '@/stores/ai/chatState';
import { useAutoTitle } from './useAutoTitle';
import { requestManager } from '@/lib/ai/requestManager';
import { getUserFacingAIError } from '@/lib/ai/errors';
import { isTemporarySession, isTemporarySessionId, needsAutoTitle } from '@/lib/ai/temporaryChat';
import {
  buildMentionedNotesContext,
  buildMessageImageSources,
  loadMentionedNotes,
  normalizeNoteMentions,
  normalizeVisionAttachment,
  refreshManagedBudgetIfNeeded,
} from './chatService/helpers';
import { runStreamedAssistantMessage } from './chatService/runStreamedAssistantMessage';

const INVISIBLE_BREAK_REGEX = /[\u200b\u200c\u200d\ufeff]/g;
const UNIVERSAL_NEWLINE_REGEX = /\r\n?|\u2028|\u2029|\u0085/g;
const EMPTY_MESSAGES: never[] = [];

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
  const currentSessionId = useUnifiedStore((s) => s.data.ai?.currentSessionId || null);
  const messages = useUnifiedStore((state) => {
    const sessionId = state.data.ai?.currentSessionId;
    if (!sessionId) {
      return EMPTY_MESSAGES;
    }

    return state.data.ai?.messages?.[sessionId] || EMPTY_MESSAGES;
  });
  const providers = useUnifiedStore((s) => s.data.ai?.providers || []);
  const models = useUnifiedStore((s) => s.data.ai?.models || []);
  const selectedModelId = useUnifiedStore((s) => s.data.ai?.selectedModelId || null);
  const customSystemPrompt = useUnifiedStore((s) => s.data.ai?.customSystemPrompt || '');
  const includeTimeContext = useUnifiedStore((s) => s.data.ai?.includeTimeContext !== false);
  const setSessionLoading = useAIUIStore((s) => s.setSessionLoading);
  const markSessionUnread = useAIUIStore((s) => s.markSessionUnread);
  const setError = useAIUIStore((s) => s.setError);

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
      const sessionId = useUnifiedStore.getState().data.ai?.currentSessionId;
      if (!sessionId) return;
      requestManager.abort(sessionId);
      setSessionLoading(sessionId, false);
  }, [setSessionLoading]);

  const maybeGenerateAutoTitle = useCallback(
    (sessionId: string, providerId: string, modelId: string) => {
      const session = useUnifiedStore.getState().data.ai?.sessions.find((item) => item.id === sessionId);
      if (isTemporarySessionId(sessionId) || isTemporarySession(session)) return;
      if (!session || !needsAutoTitle(session.title)) return;
      void generateAutoTitle(sessionId, providerId, modelId);
    },
    [generateAutoTitle]
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
        activeSessionId = aiActions.createSession('');
      }

      const targetSessionId = activeSessionId;

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

      aiActions.addMessage({
        role: 'user',
        content: storageContent,
        imageSources: messageImageSources,
        modelId: selectedModel.id,
      });

      const assistantMessageId = generateId('msg-');
      aiActions.addMessage({
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        modelId: selectedModel.id,
      });

      const targetSession = useUnifiedStore.getState().data.ai?.sessions.find((item) => item.id === targetSessionId);
      const isTemporaryTarget = isTemporarySessionId(targetSessionId) || isTemporarySession(targetSession);

      try {
        const timezoneOffset = useUnifiedStore.getState().data.settings.timezone.offset;
        const requestHistory = buildRequestHistory({
          history: messages,
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
          updateMessage: aiActions.updateMessage,
          completeMessage: aiActions.completeMessage,
          setSessionLoading,
          setError,
          buildErrorPayload: buildChatErrorPayload,
          onSuccess: () => {
            refreshManagedBudgetIfNeeded(provider.id);
            if (!isTemporaryTarget) {
              maybeGenerateAutoTitle(targetSessionId, provider.id, selectedModel.id);
            }

            const current = useUnifiedStore.getState().data.ai?.currentSessionId;
            if (targetSessionId !== current && !isTemporaryTarget) {
              markSessionUnread(targetSessionId);
            }
          },
        });
      } catch (error) {
        const { message, xml } = buildChatErrorPayload(error)
        setError(message);
        aiActions.updateMessage(targetSessionId, assistantMessageId, xml);
      }
    },
    [
      currentSessionId,
      selectedModel,
      providers,
      customSystemPrompt,
      includeTimeContext,
      setSessionLoading,
      setError,
      messages,
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
      const initialMessages = useUnifiedStore.getState().data.ai?.messages[sessionId] || [];
      if (!initialMessages.some((m) => m.id === messageId)) {
        return;
      }

      aiActions.editMessageAndBranch(sessionId, messageId, newContent);

      const assistantMessageId = generateId('msg-');
      aiActions.addMessage({
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        modelId: selectedModel.id,
      });

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
          updateMessage: aiActions.updateMessage,
          completeMessage: aiActions.completeMessage,
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
        aiActions.updateMessage(sessionId, assistantMessageId, xml);
      }
    },
    [
      currentSessionId,
      selectedModel,
      providers,
      customSystemPrompt,
      includeTimeContext,
      setError,
      setSessionLoading,
      maybeGenerateAutoTitle,
    ]
  );

  const regenerate = useCallback(
    async (msgId: string) => {
      if (!selectedModel || !currentSessionId) return;
      const sessionId = currentSessionId;

      const msgIndex = messages.findIndex((m) => m.id === msgId);
      if (msgIndex <= 0) return;

      const promptMsg = messages[msgIndex - 1];
      if (promptMsg.role !== 'user') return;

      const history = messages.slice(0, msgIndex - 1);
      const provider = providers.find((p) => p.id === selectedModel.providerId);
      if (!provider) return;
      if (provider.enabled === false) {
        setError('This channel is turned off.');
        return;
      }

      aiActions.addVersion(msgId);

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
          updateMessage: aiActions.updateMessage,
          completeMessage: aiActions.completeMessage,
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
        aiActions.updateMessage(sessionId, msgId, xml);
      }
    },
    [
      selectedModel,
      messages,
      providers,
      customSystemPrompt,
      includeTimeContext,
      setSessionLoading,
      setError,
      currentSessionId,
      maybeGenerateAutoTitle,
    ]
  );

  return { sendMessage, regenerate, editMessage, stop };
}
