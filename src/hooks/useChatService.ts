import { useCallback } from 'react';
import { useAIStore } from '@/stores/useAIStore';
import { openaiClient } from '@/lib/ai/providers/openai';
import { convertToBase64, type Attachment } from '@/lib/storage/attachmentStorage';
import type { ChatMessage, ChatMessageContent, ChatMessageContentPart } from '@/lib/ai/types';
import { TIME_SYSTEM_PROMPT, IMAGE_PLACEHOLDER } from '@/lib/ai/prompts';
import { useUnifiedStore } from '@/stores/useUnifiedStore';
import { useAutoTitle } from './useAutoTitle';
import { requestManager } from '@/lib/ai/requestManager';

const INVISIBLE_BREAK_REGEX = /[\u200b\u200c\u200d\ufeff]/g;
const UNIVERSAL_NEWLINE_REGEX = /\r\n?|\u2028|\u2029|\u0085/g;

function formatTimeByOffset(offset: number): string {
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60 * 1000;
  const targetMs = utcMs + offset * 60 * 60 * 1000;
  const targetDate = new Date(targetMs);

  const year = targetDate.getUTCFullYear();
  const month = String(targetDate.getUTCMonth() + 1).padStart(2, '0');
  const day = String(targetDate.getUTCDate()).padStart(2, '0');
  const hours = String(targetDate.getUTCHours()).padStart(2, '0');
  const minutes = String(targetDate.getUTCMinutes()).padStart(2, '0');
  const seconds = String(targetDate.getUTCSeconds()).padStart(2, '0');

  const sign = offset >= 0 ? '+' : '-';
  const absoluteOffset = Math.abs(offset);
  const offsetHours = Math.floor(absoluteOffset);
  const offsetMinutes = Math.round((absoluteOffset - offsetHours) * 60);
  const offsetText = `${sign}${String(offsetHours).padStart(2, '0')}:${String(offsetMinutes).padStart(2, '0')}`;

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds} GMT${offsetText}`;
}

function createTimeContext(modelId: string) {
  const offset = useUnifiedStore.getState().data.settings.timezone.offset;
  const timeInfo = formatTimeByOffset(offset);
  return {
    role: 'system',
    content: TIME_SYSTEM_PROMPT(timeInfo),
    modelId,
    id: `time-${Date.now()}`,
    timestamp: Date.now(),
  };
}

function sanitizeHistory(messages: ChatMessage[]): ChatMessage[] {
  return messages.map((msg) => {
    if (typeof msg.content === 'string') {
      return {
        ...msg,
        content: msg.content.replace(/!\[.*?\]\(.*?\)/g, IMAGE_PLACEHOLDER),
      };
    }
    return msg;
  });
}

export function useChatService() {
  const { generateAutoTitle } = useAutoTitle();

  const {
    messages: allMessages,
    currentSessionId,
    createSession,
    addMessage,
    updateMessage,
    completeMessage,
    editMessageAndBranch,
    addVersion,
    getSelectedModel,
    providers,
    temporaryChatEnabled,
    isTemporarySession,
    nativeWebSearchEnabled,
    setSessionLoading,
    markSessionUnread,
    setError,
  } = useAIStore();

  const messages = currentSessionId ? allMessages[currentSessionId] || [] : [];
  const selectedModel = getSelectedModel();

  const stop = useCallback(() => {
    const sessionId = useUnifiedStore.getState().data.ai?.currentSessionId;
    if (!sessionId) return;
    requestManager.abort(sessionId);
    setSessionLoading(sessionId, false);
  }, [setSessionLoading]);

  const sendMessage = useCallback(
    async (text: string, attachments: Attachment[]) => {
      const isTextEmpty = !text || text.trim().length === 0;
      const hasNoAttachments = !attachments || attachments.length === 0;

      if ((isTextEmpty && hasNoAttachments) || !selectedModel) return;

      const provider = providers.find((p) => p.id === selectedModel.providerId);
      if (!provider) {
        setError('Provider not found');
        return;
      }

      const normalizedInput = text.replace(INVISIBLE_BREAK_REGEX, '').replace(UNIVERSAL_NEWLINE_REGEX, '\n');
      const userMessageText = normalizedInput.trim();

      let activeSessionId = currentSessionId;
      let isNewSession = false;
      if (!activeSessionId) {
        activeSessionId = createSession('');
        isNewSession = true;
      }

      const targetSessionId = activeSessionId;

      let storageContent = userMessageText;
      if (attachments.length > 0) {
        const imageMarkdown = attachments
          .filter((a) => a.type.startsWith('image/'))
          .map((a) => `![image](${a.assetUrl})`)
          .join('\n\n');
        storageContent = imageMarkdown + (userMessageText ? `\n\n${userMessageText}` : '');
      }

      addMessage({
        role: 'user',
        content: storageContent,
        modelId: selectedModel.id,
      });

      const assistantMessageId = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
      addMessage({
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        modelId: selectedModel.id,
      });

      const controller = requestManager.start(targetSessionId);
      setSessionLoading(targetSessionId, true);
      setError(null);

      const isTemporaryTarget = isTemporarySession(targetSessionId);

      let shouldGenerateTitle = isNewSession && !temporaryChatEnabled && !isTemporaryTarget;
      if (!shouldGenerateTitle && targetSessionId && !temporaryChatEnabled && !isTemporaryTarget) {
        const state = useUnifiedStore.getState();
        const session = state.data.ai?.sessions.find((s) => s.id === targetSessionId);
        if (session && (session.title === 'New Chat' || session.title === 'New Image Chat')) {
          shouldGenerateTitle = true;
        }
      }

      if (shouldGenerateTitle && targetSessionId) {
        const titleSessionId = targetSessionId;
        generateAutoTitle(titleSessionId, userMessageText || 'Image Query', provider.id, selectedModel.id).catch((e) =>
          console.error(e)
        );
      }

      try {
        const finalHistory = [...messages, createTimeContext(selectedModel.id) as ChatMessage];
        const sanitizedHistory = sanitizeHistory(finalHistory);

        let apiMessageContent: ChatMessageContent = userMessageText;
        if (attachments.length > 0) {
          const parts: ChatMessageContentPart[] = [];
          if (userMessageText) {
            parts.push({ type: 'text', text: userMessageText });
          }
          for (const att of attachments) {
            if (att.type.startsWith('image/')) {
              try {
                const base64 = await convertToBase64(att);
                parts.push({
                  type: 'image_url',
                  image_url: { url: base64 },
                });
              } catch (e) {
                console.error(e);
              }
            }
          }
          if (parts.length > 0) {
            apiMessageContent = parts;
          }
        }

        await openaiClient.sendMessage(
          apiMessageContent,
          sanitizedHistory,
          selectedModel,
          provider,
          (chunk) => updateMessage(targetSessionId, assistantMessageId, chunk),
          controller.signal,
          { nativeWebSearch: nativeWebSearchEnabled }
        );
        completeMessage(targetSessionId, assistantMessageId);

        const current = useUnifiedStore.getState().data.ai?.currentSessionId;
        if (targetSessionId !== current && !isTemporarySession(targetSessionId)) {
          markSessionUnread(targetSessionId);
        }
      } catch (error: any) {
        if (error.name === 'AbortError') {
          return;
        }

        const type = error.type || 'UNKNOWN';
        const code = error.statusCode || error.status || '';
        const detail = error.message || 'Unknown error occurred';
        const errorXml = `<error type="${type}" code="${code}">${detail}</error>`;

        setError(detail);
        updateMessage(targetSessionId, assistantMessageId, errorXml);
      } finally {
        requestManager.finish(targetSessionId, controller);
        setSessionLoading(targetSessionId, false);
      }
    },
    [
      currentSessionId,
      createSession,
      addMessage,
      updateMessage,
      completeMessage,
      selectedModel,
      providers,
      temporaryChatEnabled,
      isTemporarySession,
      nativeWebSearchEnabled,
      setSessionLoading,
      setError,
      messages,
      generateAutoTitle,
      markSessionUnread,
    ]
  );

  const editMessage = useCallback(
    async (messageId: string, newContent: string) => {
      if (!currentSessionId || !selectedModel) return;
      const sessionId = currentSessionId;
      const provider = providers.find((p) => p.id === selectedModel.providerId);
      if (!provider) return;
      const initialMessages = useUnifiedStore.getState().data.ai?.messages[sessionId] || [];
      if (!initialMessages.some((m) => m.id === messageId)) {
        return;
      }

      editMessageAndBranch(sessionId, messageId, newContent);

      const assistantMessageId = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
      addMessage({
        id: assistantMessageId,
        role: 'assistant',
        content: '',
        modelId: selectedModel.id,
      });

      const controller = requestManager.start(sessionId);
      setSessionLoading(sessionId, true);
      setError(null);

      try {
        const state = useUnifiedStore.getState();
        const sessionMessages = state.data.ai?.messages[sessionId] || [];

        const userMsgIndex = sessionMessages.findIndex((m) => m.id === messageId);
        if (userMsgIndex === -1) {
          return;
        }
        const history = sessionMessages.slice(0, userMsgIndex);

        const finalHistory = [...history, createTimeContext(selectedModel.id) as ChatMessage];
        const sanitizedHistory = sanitizeHistory(finalHistory);

        await openaiClient.sendMessage(
          newContent,
          sanitizedHistory,
          selectedModel,
          provider,
          (chunk) => updateMessage(sessionId, assistantMessageId, chunk),
          controller.signal,
          { nativeWebSearch: nativeWebSearchEnabled }
        );
        completeMessage(sessionId, assistantMessageId);
      } catch (error: any) {
        if (error.name === 'AbortError') {
          return;
        }

        const detail = error.message || 'Unknown error';
        const errorXml = `<error type="${error.type || 'UNKNOWN'}" code="${error.statusCode || ''}">${detail}</error>`;
        updateMessage(sessionId, assistantMessageId, errorXml);
      } finally {
        requestManager.finish(sessionId, controller);
        setSessionLoading(sessionId, false);
      }
    },
    [
      currentSessionId,
      selectedModel,
      providers,
      nativeWebSearchEnabled,
      editMessageAndBranch,
      addMessage,
      updateMessage,
      completeMessage,
      setError,
      setSessionLoading,
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

      addVersion(msgId);

      const controller = requestManager.start(sessionId);
      setSessionLoading(sessionId, true);

      try {
        await openaiClient.sendMessage(
          promptMsg.content,
          history,
          selectedModel,
          provider,
          (chunk) => updateMessage(sessionId, msgId, chunk),
          controller.signal,
          { nativeWebSearch: nativeWebSearchEnabled }
        );
        completeMessage(sessionId, msgId);
      } catch (error: any) {
        if (error.name === 'AbortError') {
          return;
        }

        const type = error.type || 'UNKNOWN';
        const code = error.statusCode || error.status || '';
        const detail = error.message || 'Regeneration Failed';
        const errorXml = `<error type="${type}" code="${code}">${detail}</error>`;

        setError(detail);
        updateMessage(sessionId, msgId, errorXml);
      } finally {
        requestManager.finish(sessionId, controller);
        setSessionLoading(sessionId, false);
      }
    },
    [
      selectedModel,
      messages,
      providers,
      nativeWebSearchEnabled,
      addVersion,
      setSessionLoading,
      updateMessage,
      completeMessage,
      setError,
      currentSessionId,
    ]
  );

  return { sendMessage, regenerate, editMessage, stop };
}
