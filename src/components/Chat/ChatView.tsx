import { useState, useRef, useEffect, useCallback } from 'react';
import { MdContentCopy, MdVolumeUp, MdRefresh, MdNavigateBefore, MdNavigateNext, MdStop, MdPlayArrow, MdLanguage, MdOpenInNew, MdKeyboardArrowDown, MdKeyboardArrowUp } from 'react-icons/md';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useAIStore } from '@/stores/useAIStore';
import { newAPIClient } from '@/lib/ai/providers/newapi';
import { MarkdownRenderer } from './MarkdownRenderer';
import { ChatInput } from './ChatInput';
import { performWebSearch, formatSearchResults } from '@/lib/ai/search';
import '@/components/Notes/features/Editor/styles/core.css';

export function ChatView() {
  // TTS State
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);
  
  // Sources Toggle State
  const [expandedSources, setExpandedSources] = useState<Set<string>>(new Set());
  
  // Abort Controller for stopping generation
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

  const toggleSources = (msgId: string) => {
      setExpandedSources(prev => {
          const next = new Set(prev);
          if (next.has(msgId)) next.delete(msgId);
          else next.add(msgId);
          return next;
      });
  };

  const handleStop = useCallback(() => {
      if (abortControllerRef.current) {
          abortControllerRef.current.abort();
          abortControllerRef.current = null;
      }
      setLoading(false);
  }, [setLoading]);

  const handleSend = useCallback(async (text: string) => {
    if (!text.trim() || !selectedModel) return;

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

    const userMessage = text.trim();
    
    let activeSessionId = currentSessionId;
    if (!activeSessionId) {
        activeSessionId = createSession(userMessage.slice(0, 30));
    }

    addMessage({
      role: 'user',
      content: userMessage,
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
      if (webSearchEnabled) {
          console.log('[ChatView] Web search is ENABLED. Starting search flow...');
          updateMessage(assistantMessageId, '🔍 正在联网搜索...');
          const results = await performWebSearch(userMessage);
          
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

      await newAPIClient.sendMessage(
        userMessage,
        finalHistory, 
        selectedModel,
        provider,
        (chunk) => {
          updateMessage(assistantMessageId, chunk);
        },
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

  const handleRegenerate = async (msgId: string) => {
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
          await newAPIClient.sendMessage(
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
  };

  const copyToClipboard = (text: string) => navigator.clipboard.writeText(text);
  
  const handleSpeak = (msgId: string, text: string) => {
      if (speakingMsgId === msgId) {
          window.speechSynthesis.cancel();
          setSpeakingMsgId(null);
      } else {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.onend = () => setSpeakingMsgId(null);
          utterance.onerror = () => setSpeakingMsgId(null);
          setSpeakingMsgId(msgId);
          window.speechSynthesis.speak(utterance);
      }
  };

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
              {messages.map((msg) => {
                const isUser = msg.role === 'user';
                const versions = msg.versions || [msg.content];
                const currentVer = (msg.currentVersionIndex ?? 0) + 1;
                const totalVer = versions.length;
                const isSpeaking = speakingMsgId === msg.id;
                const hasCitations = msg.citations && msg.citations.length > 0;
                const isSourcesOpen = expandedSources.has(msg.id);
                
                return (
                  <div
                    key={msg.id}
                    className={cn(
                      "flex w-full group",
                      isUser ? "justify-end" : "justify-start"
                    )}
                  >
                    <div 
                        className={cn(
                            "flex flex-col min-w-0",
                            isUser ? "items-end max-w-[85%]" : "w-full items-start"
                        )}
                    >
                        {isUser ? (
                            <div className="milkdown inline-block bg-[#F4F4F5] dark:bg-[#2C2C2C] px-5 py-3 rounded-[20px] rounded-tr-md text-gray-900 dark:text-gray-100 text-[15px] leading-7 shadow-sm border border-black/5 dark:border-white/5 text-left break-words">
                                <div className="whitespace-pre-wrap">{msg.content}</div>
                            </div>
                        ) : (
                            <div className="w-full pl-0">
                                <div className="[&>*:last-child]:mb-0">
                                    <MarkdownRenderer content={msg.content} />
                                </div>
                                
                                {/* Toolbar */}
                                {!isLoading && (
                                    <div className="flex flex-col mt-1">
                                            
                                            <button onClick={() => copyToClipboard(msg.content)} className="p-1.5 text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors rounded-md hover:bg-gray-100 dark:hover:bg-zinc-800" title="Copy">
                                                <MdContentCopy size={14} />
                                            </button>
                                            
                                            <button 
                                                onClick={() => handleSpeak(msg.id, msg.content)} 
                                                className={cn(
                                                    "p-1.5 transition-colors rounded-md hover:bg-gray-100 dark:hover:bg-zinc-800",
                                                    isSpeaking ? "text-red-500" : "text-gray-400 hover:text-gray-900 dark:hover:text-gray-200"
                                                )} 
                                                title={isSpeaking ? "Stop" : "Read Aloud"}
                                            >
                                                {isSpeaking ? <MdStop size={14} /> : <MdVolumeUp size={14} />}
                                            </button>

                                            <button onClick={() => handleRegenerate(msg.id)} className="p-1.5 text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors rounded-md hover:bg-gray-100 dark:hover:bg-zinc-800" title="Regenerate">
                                                <MdRefresh size={14} />
                                            </button>

                                            {/* Sources Toggle Button - Moved to End */}
                                            {hasCitations && (
                                                <button 
                                                    onClick={() => toggleSources(msg.id)}
                                                    className={cn(
                                                        "flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-colors ml-1",
                                                        isSourcesOpen 
                                                            ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400" 
                                                            : "bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-zinc-700"
                                                    )}
                                                >
                                                    <MdLanguage size={12} />
                                                    <span>Sources</span>
                                                    <span className="opacity-60">{msg.citations?.length}</span>
                                                    {isSourcesOpen ? <MdKeyboardArrowUp size={12}/> : <MdKeyboardArrowDown size={12}/>}
                                                </button>
                                            )}
                                        </div>

                                        {/* Expanded Sources Panel */}
                                        <AnimatePresence>
                                            {isSourcesOpen && msg.citations && (
                                                <motion.div
                                                    initial={{ height: 0, opacity: 0 }}
                                                    animate={{ height: "auto", opacity: 1 }}
                                                    exit={{ height: 0, opacity: 0 }}
                                                    transition={{ duration: 0.2 }}
                                                    className="overflow-hidden"
                                                >
                                                    <div className="pt-2 pb-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                        {msg.citations.slice(0, 4).map((citation, idx) => {
                                                            const hostname = new URL(citation.url).hostname;
                                                            return (
                                                                <a 
                                                                    key={idx} 
                                                                    href={citation.url}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="flex items-center gap-2.5 p-2 rounded-md border border-gray-100 dark:border-zinc-800 bg-gray-50/50 dark:bg-zinc-900/50 hover:bg-white dark:hover:bg-zinc-800 hover:shadow-sm transition-all group/source no-underline"
                                                                >
                                                                    <div className="flex-shrink-0 w-4 h-4 bg-white rounded-sm overflow-hidden flex items-center justify-center border border-gray-100 dark:border-gray-700">
                                                                        <img 
                                                                            src={`https://www.google.com/s2/favicons?domain=${hostname}&sz=32`} 
                                                                            alt="" 
                                                                            className="w-3 h-3 object-contain opacity-80"
                                                                            onError={(e) => (e.currentTarget.style.display = 'none')}
                                                                        />
                                                                    </div>
                                                                    <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                                                                        <span className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate group-hover/source:text-blue-600 dark:group-hover/source:text-blue-400 transition-colors">
                                                                            {citation.title}
                                                                        </span>
                                                                        <span className="text-[10px] text-gray-400 truncate">
                                                                            {hostname.replace('www.', '')}
                                                                        </span>
                                                                    </div>
                                                                </a>
                                                            );
                                                        })}
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                  </div>
                );
              })}
              {isLoading && (
                <div className="flex w-full justify-start pl-0 mt-4 mb-2">
                    {/* High-Vibe Elastic (Blue) */}
                    <div className="relative h-6 w-28 flex items-center justify-center overflow-hidden">
                        {[0, 1, 2, 3].map((i) => (
                            <motion.div
                                key={`a-${i}`}
                                className="absolute h-[4px] rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.4)]"
                                initial={{ x: -50, width: 4 }}
                                animate={{ 
                                    x: 50, 
                                    y: [0, -5, 0, 5, 0], 
                                    width: [4, 16, 4, 16, 4], 
                                    opacity: [0, 1, 1, 1, 0],
                                }}
                                transition={{ duration: 1.0, repeat: Infinity, delay: i * 0.2, ease: "easeInOut" }}
                                style={{ left: "50%", top: "50%", marginTop: -2, marginLeft: -2 }}
                            />
                        ))}
                        {[0, 1, 2, 3].map((i) => (
                            <motion.div
                                key={`b-${i}`}
                                className="absolute h-[4px] rounded-full bg-blue-400/80"
                                initial={{ x: -50, width: 4 }}
                                animate={{ 
                                    x: 50, 
                                    y: [0, 5, 0, -5, 0], 
                                    width: [4, 16, 4, 16, 4], 
                                    opacity: [0, 1, 1, 1, 0],
                                }}
                                transition={{ duration: 1.0, repeat: Infinity, delay: i * 0.2, ease: "easeInOut" }}
                                style={{ left: "50%", top: "50%", marginTop: -2, marginLeft: -2 }}
                            />
                        ))}
                    </div>
                </div>
              )}
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