import { useCallback } from 'react';
import { useAIStore } from '@/stores/useAIStore';
import { openaiClient } from '@/lib/ai/providers/openai';
import { convertToBase64, type Attachment } from '@/lib/storage/attachmentStorage';
import type { ChatMessageContent, ChatMessageContentPart } from '@/lib/ai/types';
import { TIME_SYSTEM_PROMPT, IMAGE_PLACEHOLDER } from '@/lib/ai/prompts';
import { useUnifiedStore } from '@/stores/useUnifiedStore';
import { useAutoTitle } from './useAutoTitle';
import { requestManager } from '@/lib/ai/requestManager';

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
    nativeWebSearchEnabled,
    setSessionLoading,
    markSessionUnread,
    setError 
  } = useAIStore();

  const messages = currentSessionId ? (allMessages[currentSessionId] || []) : [];
  const selectedModel = getSelectedModel();

  // ... (stop function unchanged)

  const sendMessage = useCallback(async (text: string, attachments: Attachment[]) => {
    // ... (sendMessage logic unchanged)
    // Just need to ensure addMessage calls in sendMessage use compatible types if changed, 
    // but useAIStore handles the abstraction.
    const isTextEmpty = !text || text.trim().length === 0;
    const hasNoAttachments = !attachments || attachments.length === 0;
    
    if ((isTextEmpty && hasNoAttachments) || !selectedModel) return;

    const provider = providers.find(p => p.id === selectedModel.providerId);
    if (!provider) {
      setError('Provider not found');
      return;
    }

    const userMessageText = text.trim();
    
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
            .filter(a => a.type.startsWith('image/'))
            .map(a => `![image](${a.assetUrl})`)
            .join('\n\n');
        storageContent = imageMarkdown + (userMessageText ? `\n\n${userMessageText}` : '');
    }

    addMessage({
      role: 'user',
      content: storageContent,
      modelId: selectedModel.id
    });

    const assistantMessageId = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    addMessage({
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      modelId: selectedModel.id
    });

    const controller = requestManager.start(targetSessionId);
    setSessionLoading(targetSessionId, true);
    setError(null);

    let shouldGenerateTitle = isNewSession;
    if (!shouldGenerateTitle && targetSessionId) {
        const state = useUnifiedStore.getState();
        const session = state.data.ai?.sessions.find(s => s.id === targetSessionId);
        if (session && (session.title === 'New Chat' || session.title === 'New Image Chat')) {
            shouldGenerateTitle = true;
        }
    }

    if (shouldGenerateTitle && targetSessionId) {
        const titleSessionId = targetSessionId;
        generateAutoTitle(titleSessionId, userMessageText || "Image Query", provider.id, selectedModel.id)
            .catch(e => console.error(e));
    }

    try {
      let finalHistory = [...messages];
      const timeInfo = `${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })}`;
      const timeContext = {
          role: 'system',
          content: TIME_SYSTEM_PROMPT(timeInfo),
          modelId: selectedModel.id,
          id: `time-${Date.now()}`,
          timestamp: Date.now()
      };
      finalHistory = [...finalHistory, timeContext as any];

      const sanitizedHistory = finalHistory.map(msg => {
          if (typeof msg.content === 'string') {
              return { 
                  ...msg, 
                  content: msg.content.replace(/!\[.*?\]\(.*?\)/g, IMAGE_PLACEHOLDER) 
              };
          }
          return msg;
      });

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
                          image_url: { url: base64 } 
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
      if (targetSessionId !== current) {
          markSessionUnread(targetSessionId);
      }

    } catch (error: any) {
      if (error.name === 'AbortError') {
          // ignore
      } else {
          const type = error.type || 'UNKNOWN';
          const code = error.statusCode || error.status || '';
          const detail = error.message || 'Unknown error occurred';
          
          const errorXml = `<error type="${type}" code="${code}">${detail}</error>`;
          
          setError(detail); 
          updateMessage(targetSessionId, assistantMessageId, errorXml);
      }
    } finally {
      requestManager.finish(targetSessionId);
      setSessionLoading(targetSessionId, false);
    }
  }, [currentSessionId, createSession, addMessage, updateMessage, completeMessage, selectedModel, providers, nativeWebSearchEnabled, setSessionLoading, setError, messages, generateAutoTitle, markSessionUnread]);

  const editMessage = useCallback(async (messageId: string, newContent: string) => {
      if (!currentSessionId || !selectedModel) return;
      const sessionId = currentSessionId;
      const provider = providers.find(p => p.id === selectedModel.providerId);
      if (!provider) return;

      // Use Branching Logic
      editMessageAndBranch(sessionId, messageId, newContent);

      const assistantMessageId = `msg-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
      addMessage({
          id: assistantMessageId,
          role: 'assistant',
          content: '',
          modelId: selectedModel.id
      });

      const controller = requestManager.start(sessionId);
      setSessionLoading(sessionId, true);
      setError(null);

      try {
          const state = useUnifiedStore.getState();
          const sessionMessages = state.data.ai?.messages[sessionId] || [];
          
          const userMsgIndex = sessionMessages.findIndex(m => m.id === messageId);
          // History includes everything BEFORE the edited message
          const history = sessionMessages.slice(0, userMsgIndex);
          
          let finalHistory = [...history];
          const timeInfo = `${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })}`;
          finalHistory.push({
              role: 'system',
              content: TIME_SYSTEM_PROMPT(timeInfo),
              modelId: selectedModel.id,
              id: `time-${Date.now()}`,
              timestamp: Date.now()
          } as any);

          const sanitizedHistory = finalHistory.map(msg => {
              if (typeof msg.content === 'string') {
                  return { 
                      ...msg, 
                      content: msg.content.replace(/!\[.*?\]\(.*?\)/g, IMAGE_PLACEHOLDER) 
                  };
              }
              return msg;
          });

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
          if (error.name !== 'AbortError') {
              const detail = error.message || 'Unknown error';
              const errorXml = `<error type="${error.type || 'UNKNOWN'}" code="${error.statusCode || ''}">${detail}</error>`;
              updateMessage(sessionId, assistantMessageId, errorXml);
          }
      } finally {
          requestManager.finish(sessionId);
          setSessionLoading(sessionId, false);
      }
  }, [currentSessionId, selectedModel, providers, nativeWebSearchEnabled, editMessageAndBranch, addMessage, updateMessage, completeMessage, setError, setSessionLoading]);

  const regenerate = useCallback(async (msgId: string) => {
      if (!selectedModel || !currentSessionId) return;
      const sessionId = currentSessionId;

      const msgIndex = messages.findIndex(m => m.id === msgId);
      if (msgIndex <= 0) return;
      
      const promptMsg = messages[msgIndex - 1];
      if (promptMsg.role !== 'user') return;
      
      const history = messages.slice(0, msgIndex - 1);
      const provider = providers.find(p => p.id === selectedModel.providerId);
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
          if (error.name !== 'AbortError') {
              const type = error.type || 'UNKNOWN';
              const code = error.statusCode || error.status || '';
              const detail = error.message || 'Regeneration Failed';
              
              const errorXml = `<error type="${type}" code="${code}">${detail}</error>`;
              
              setError(detail);
              updateMessage(sessionId, msgId, errorXml);
          }
      } finally {
          requestManager.finish(sessionId);
          setSessionLoading(sessionId, false);
      }
  }, [selectedModel, messages, providers, nativeWebSearchEnabled, addVersion, setSessionLoading, updateMessage, completeMessage, setError, currentSessionId]);

  return { sendMessage, regenerate, editMessage, stop };
}
