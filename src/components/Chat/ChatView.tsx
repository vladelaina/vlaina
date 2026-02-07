import { useState, useRef, useEffect, useCallback } from 'react';
import { useAIStore } from '@/stores/useAIStore';
import { openaiClient } from '@/lib/ai/providers/openai';
import { ChatInput } from './ChatInput';
import { MessageItem } from './messages/MessageItem';
import { ChatLoading } from './components/ChatLoading';
import { performWebSearch, formatSearchResults } from '@/lib/ai/search';
import { convertToBase64, type Attachment } from '@/lib/storage/attachmentStorage';
import type { ChatMessageContent, ChatMessageContentPart } from '@/lib/ai/types';
import '@/components/Notes/features/Editor/styles/core.css';

export function ChatView() {
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);
  const [expandedSources, setExpandedSources] = useState<Set<string>>(new Set());
  const abortControllerRef = useRef<AbortController | null>(null);

  const { 
    messages: allMessages, 
    currentSessionId,
    createSession,
    addMessage, 
    updateMessage, 
    completeMessage,
    addVersion,
    switchVersion,
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
  
  const scrollRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
      if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
  }, [messages.length, isLoading]);

  useEffect(() => {
      return () => {
          window.speechSynthesis.cancel();
          if (abortControllerRef.current) {
              abortControllerRef.current.abort();
          }
      };
  }, []);

  const toggleSources = useCallback((msgId: string) => {
      setExpandedSources(prev => {
          const next = new Set(prev);
          if (next.has(msgId)) next.delete(msgId);
          else next.add(msgId);
          return next;
      });
  }, []);

  const handleStop = useCallback(() => {
      if (abortControllerRef.current) {
          abortControllerRef.current.abort();
          abortControllerRef.current = null;
      }
      setLoading(false);
  }, [setLoading]);

  const handleSend = useCallback(async (text: string, attachments: Attachment[]) => {
    if ((!text.trim() && attachments.length === 0) || !selectedModel) return;

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
    if (!activeSessionId) {
        activeSessionId = createSession(userMessageText.slice(0, 30) || 'New Image Chat');
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

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      let finalHistory = [...messages];
      
      // Web Search Logic
      if (webSearchEnabled && userMessageText) {
          console.log('[ChatView] Web search is ENABLED. Starting search flow...');
          updateMessage(assistantMessageId, '🔍 正在联网搜索...');
          
          const results = await performWebSearch(userMessageText, controller.signal);
          
          let searchContext = '';
          if (results.length > 0) {
              setCitations(assistantMessageId, results);
              searchContext = formatSearchResults(results);
          } else {
              searchContext = "No search results found.";
          }
          
          const now = new Date();
          const systemContext = `Current Date/Time: ${now.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })} ${Intl.DateTimeFormat().resolvedOptions().timeZone}
          
Internet Search Results:
${searchContext}

Please use the information above to answer the user question. CITATION REQUIREMENT: You MUST cite your sources using [1], [2], etc. notation at the end of sentences that use information from the search results.`;

          const contextMsg = {
              role: 'system',
              content: systemContext,
              modelId: selectedModel.id,
              id: `search-${Date.now()}`,
              timestamp: Date.now()
          };
          finalHistory = [...finalHistory, contextMsg as any];
          updateMessage(assistantMessageId, '🧠 正在思考...');
      } else {
          const now = new Date();
          const timeContext = {
              role: 'system',
              content: `Current Date/Time: ${now.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })}`,
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
                  content: msg.content.replace(/!\[.*?\]\(.*?\)/g, '[Image]') 
              };
          }
          return msg;
      });

      // 2. Construct Content for API
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
          console.log('[ChatView] Request aborted.');
      } else {
          console.error('[ChatView] Message failed', error);
          setError(error instanceof Error ? error.message : 'Failed to send message');
          updateMessage(assistantMessageId, '❌ Failed to get response');
      }
    } finally {
      if (abortControllerRef.current === controller) {
          setLoading(false);
          abortControllerRef.current = null;
      }
    }
  }, [currentSessionId, createSession, addMessage, updateMessage, completeMessage, selectedModel, providers, setLoading, setError, messages, isLoading, webSearchEnabled, setCitations]);

  const handleRegenerate = useCallback(async (msgId: string) => {
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
              console.error('[ChatView] Regen failed', error);
              setError('Failed to regenerate');
          }
      } finally {
          if (abortControllerRef.current === controller) {
              setLoading(false);
              abortControllerRef.current = null;
          }
      }
  }, [isLoading, selectedModel, messages, providers, addVersion, setLoading, updateMessage, completeMessage, setError]);

  const copyToClipboard = useCallback((text: string) => navigator.clipboard.writeText(text), []);
  
  const handleSpeak = useCallback((msgId: string, text: string) => {
      setSpeakingMsgId(prev => {
          if (prev === msgId) {
              window.speechSynthesis.cancel();
              return null;
          }
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.onend = () => setSpeakingMsgId(null);
          utterance.onerror = () => setSpeakingMsgId(null);
          window.speechSynthesis.speak(utterance);
          return msgId;
      });
  }, []);

  const handleOpenSettings = useCallback(() => {
      const event = new CustomEvent('open-settings', { detail: { tab: 'ai' } })
      window.dispatchEvent(event)
  }, []);

  return (
    <div className="h-full w-full flex flex-col bg-[var(--neko-bg-primary)]">
      <div className="flex-1 overflow-y-auto" ref={scrollRef}>
        <div className="max-w-3xl mx-auto px-4 py-8 pb-4">
          {messages.length > 0 && (
            <div className="space-y-8">
              {messages.map((msg) => (
                <MessageItem 
                    key={msg.id}
                    msg={msg}
                    isLoading={isLoading}
                    isSpeaking={speakingMsgId === msg.id}
                    isSourcesOpen={expandedSources.has(msg.id)}
                    onCopy={copyToClipboard}
                    onSpeak={handleSpeak}
                    onRegenerate={handleRegenerate}
                    onSwitchVersion={switchVersion}
                    onToggleSources={toggleSources}
                />
              ))}
              {isLoading && <ChatLoading />}
            </div>
          )}
        </div>
      </div>

      <ChatInput 
        onSend={handleSend} 
        onStop={handleStop}
        isLoading={isLoading} 
        selectedModel={selectedModel} 
        onOpenSettings={handleOpenSettings}
      />
    </div>
  );
}
