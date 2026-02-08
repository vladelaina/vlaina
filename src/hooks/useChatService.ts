import { useRef, useCallback } from 'react';
import { useAIStore } from '@/stores/useAIStore';
import { openaiClient } from '@/lib/ai/providers/openai';
import { performWebSearch, formatSearchResults } from '@/lib/ai/search';
import { convertToBase64, type Attachment } from '@/lib/storage/attachmentStorage';
import type { ChatMessageContent, ChatMessageContentPart } from '@/lib/ai/types';
import { SEARCH_SYSTEM_PROMPT, TIME_SYSTEM_PROMPT, IMAGE_PLACEHOLDER } from '@/lib/ai/prompts';
import { useUnifiedStore } from '@/stores/useUnifiedStore';
import { useAutoTitle } from './useAutoTitle';

export function useChatService() {
  const abortControllerRef = useRef<AbortController | null>(null);
  const { generateAutoTitle } = useAutoTitle();

  const { 
    messages: allMessages, 
    currentSessionId,
    createSession,
    addMessage, 
    updateMessage, 
    completeMessage,
    addVersion,
    setCitations,
    getSelectedModel, 
    providers, 
    webSearchEnabled,
    isLoading, 
    setLoading, 
    setError 
  } = useAIStore();

  const messages = currentSessionId ? (allMessages[currentSessionId] || []) : [];
  const selectedModel = getSelectedModel();

  const stop = useCallback(() => {
      if (abortControllerRef.current) {
          abortControllerRef.current.abort();
          abortControllerRef.current = null;
      }
      setLoading(false);
  }, [setLoading]);

  const sendMessage = useCallback(async (text: string, attachments: Attachment[]) => {
    const isTextEmpty = !text || text.trim().length === 0;
    const hasNoAttachments = !attachments || attachments.length === 0;
    
    if ((isTextEmpty && hasNoAttachments) || !selectedModel) return;

    if (isLoading && abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
    }

    const provider = providers.find(p => p.id === selectedModel.providerId);
    if (!provider) {
      setError('Provider not found');
      setLoading(false);
      return;
    }

    const userMessageText = text.trim();
    
    let activeSessionId = currentSessionId;
    let isNewSession = false;
    if (!activeSessionId) {
        activeSessionId = createSession(userMessageText.slice(0, 30) || 'New Image Chat');
        isNewSession = true;
    }

    // 1. Construct Content for Local Storage (Markdown)
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

    setLoading(true);
    setError(null);

    // --- Auto Title Generation (Fire and Forget) ---
    // Check if we should generate a title:
    // 1. It's a newly created session
    // 2. OR the current session still has the default title
    let shouldGenerateTitle = isNewSession;
    
    if (!shouldGenerateTitle && activeSessionId) {
        const state = useUnifiedStore.getState();
        const session = state.data.ai?.sessions.find(s => s.id === activeSessionId);
        if (session && (session.title === 'New Chat' || session.title === 'New Image Chat')) {
            shouldGenerateTitle = true;
        }
    }

    if (shouldGenerateTitle && activeSessionId) {
        console.log('[ChatService] Scheduling background Auto-Title generation (delayed)...');
        // Delay 3 seconds to avoid concurrency limits (ERR_CONNECTION_CLOSED) on some providers
        setTimeout(() => {
            generateAutoTitle(activeSessionId, userMessageText || "Image Query", provider.id, selectedModel.id)
                .catch(e => console.error('[ChatService] Auto-Title failed silently:', e));
        }, 3000);
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      let finalHistory = [...messages];
      
      // Web Search Logic
      if (webSearchEnabled && userMessageText) {
          console.log('[ChatService] Web search is ENABLED. Starting search flow...');
          updateMessage(assistantMessageId, '🔍 正在联网搜索...');
          
          const results = await performWebSearch(userMessageText, controller.signal);
          
          let searchContext = '';
          if (results.length > 0) {
              setCitations(assistantMessageId, results);
              searchContext = formatSearchResults(results);
          } else {
              searchContext = "No search results found.";
          }
          
          const timeInfo = `${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })} ${Intl.DateTimeFormat().resolvedOptions().timeZone}`;
          const systemContent = SEARCH_SYSTEM_PROMPT(searchContext, timeInfo);

          const contextMsg = {
              role: 'system',
              content: systemContent,
              modelId: selectedModel.id,
              id: `search-${Date.now()}`,
              timestamp: Date.now()
          };
          finalHistory = [...finalHistory, contextMsg as any];
          updateMessage(assistantMessageId, '🧠 正在思考...');
      } else {
          const timeInfo = `${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })}`;
          const timeContext = {
              role: 'system',
              content: TIME_SYSTEM_PROMPT(timeInfo),
              modelId: selectedModel.id,
              id: `time-${Date.now()}`,
              timestamp: Date.now()
          };
          finalHistory = [...finalHistory, timeContext as any];
      }

      // Sanitize history
      const sanitizedHistory = finalHistory.map(msg => {
          if (typeof msg.content === 'string') {
              return { 
                  ...msg, 
                  content: msg.content.replace(/!\[.*?\]\(.*?\)/g, IMAGE_PLACEHOLDER) 
              };
          }
          return msg;
      });

      // 2. Construct Content for API (Multimodal)
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
                      console.error('Failed to convert image for API:', e);
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
        (chunk) => updateMessage(assistantMessageId, chunk),
        controller.signal
      );
      completeMessage(assistantMessageId);
    } catch (error: any) {
      if (error.name === 'AbortError') {
          console.log('[ChatService] Request aborted.');
      } else {
          console.error('[ChatService] Message failed', error);
          setError(error instanceof Error ? error.message : 'Failed to send message');
          updateMessage(assistantMessageId, '❌ Failed to get response');
      }
    } finally {
      if (abortControllerRef.current === controller) {
          setLoading(false);
          abortControllerRef.current = null;
      }
    }
  }, [currentSessionId, createSession, addMessage, updateMessage, completeMessage, selectedModel, providers, setLoading, setError, messages, isLoading, webSearchEnabled, setCitations, generateAutoTitle]);

  const regenerate = useCallback(async (msgId: string) => {
      if (isLoading || !selectedModel) return;
      if (abortControllerRef.current) abortControllerRef.current.abort();

      const msgIndex = messages.findIndex(m => m.id === msgId);
      if (msgIndex <= 0) return;
      
      const promptMsg = messages[msgIndex - 1];
      if (promptMsg.role !== 'user') return;
      
      const history = messages.slice(0, msgIndex - 1);
      const provider = providers.find(p => p.id === selectedModel.providerId);
      if (!provider) return;

      addVersion(msgId);
      setLoading(true);
      
      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
          await openaiClient.sendMessage(
              promptMsg.content,
              history,
              selectedModel,
              provider,
              (chunk) => updateMessage(msgId, chunk),
              controller.signal
          );
          completeMessage(msgId);
      } catch (error: any) {
          if (error.name !== 'AbortError') {
              console.error('[ChatService] Regen failed', error);
              setError('Failed to regenerate');
          }
      } finally {
          if (abortControllerRef.current === controller) {
              setLoading(false);
              abortControllerRef.current = null;
          }
      }
  }, [isLoading, selectedModel, messages, providers, addVersion, setLoading, updateMessage, completeMessage, setError]);

  return { sendMessage, regenerate, stop };
}