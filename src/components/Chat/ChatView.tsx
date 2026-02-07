import { useState, useRef, useEffect } from 'react';
import { MdSend, MdAttachFile, MdImage, MdSettings, MdContentCopy, MdVolumeUp, MdRefresh, MdNavigateBefore, MdNavigateNext, MdStop, MdPlayArrow, MdAutoAwesome } from 'react-icons/md';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { ModelSelector } from './ModelSelector';
import { useAIStore } from '@/stores/useAIStore';
import { newAPIClient } from '@/lib/ai/providers/newapi';
import { MarkdownRenderer } from './MarkdownRenderer';
import '@/components/Notes/features/Editor/styles/core.css';

export function ChatView() {
  const [message, setMessage] = useState('');
  
  // TTS State
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);

  const { 
    messages: allMessages, 
    currentSessionId,
    createSession,
    addMessage, 
    updateMessage, 
    completeMessage,
    addVersion,
    switchVersion,
    getSelectedModel, 
    providers, 
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
  }, [messages.length, messages[messages.length - 1]?.content, isLoading]);

  // Clean up TTS on unmount
  useEffect(() => {
      return () => {
          window.speechSynthesis.cancel();
      };
  }, []);

  const handleSend = async () => {
    if (!message.trim() || !selectedModel) return;

    const provider = providers.find(p => p.id === selectedModel.providerId);
    if (!provider) {
      setError('Provider not found');
      return;
    }

    const userMessage = message.trim();
    setMessage('');
    
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

    try {
      await newAPIClient.sendMessage(
        userMessage,
        messages, 
        selectedModel,
        provider,
        (chunk) => {
          updateMessage(assistantMessageId, chunk);
        }
      );
      completeMessage(assistantMessageId);
    } catch (error) {
      console.error('[ChatView] Message failed', error);
      setError(error instanceof Error ? error.message : 'Failed to send message');
      updateMessage(assistantMessageId, '❌ Failed to get response');
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerate = async (msgId: string) => {
      if (isLoading || !selectedModel) return;
      
      const msgIndex = messages.findIndex(m => m.id === msgId);
      if (msgIndex <= 0) return;
      
      const promptMsg = messages[msgIndex - 1];
      if (promptMsg.role !== 'user') return;
      
      const history = messages.slice(0, msgIndex - 1);
      const provider = providers.find(p => p.id === selectedModel.providerId);
      if (!provider) return;

      addVersion(msgId);
      setLoading(true);
      
      try {
          await newAPIClient.sendMessage(
              promptMsg.content,
              history,
              selectedModel,
              provider,
              (chunk) => updateMessage(msgId, chunk)
          );
          completeMessage(msgId);
      } catch (error) {
          console.error('[ChatView] Regen failed', error);
          setError('Failed to regenerate');
      } finally {
          setLoading(false);
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

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
                                    <div className="flex items-center gap-2 mt-1 select-none opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                        {totalVer > 1 && (
                                            <div className="flex items-center text-xs font-medium text-gray-500 bg-gray-100 dark:bg-zinc-800 rounded-md px-1 mr-2">
                                                <button onClick={() => switchVersion(msg.id, 'prev')} disabled={currentVer <= 1} className="p-1 hover:text-black dark:hover:text-white disabled:opacity-30"><MdNavigateBefore size={14}/></button>
                                                <span className="mx-1">{currentVer} / {totalVer}</span>
                                                <button onClick={() => switchVersion(msg.id, 'next')} disabled={currentVer >= totalVer} className="p-1 hover:text-black dark:hover:text-white disabled:opacity-30"><MdNavigateNext size={14}/></button>
                                            </div>
                                        )}
                                        
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
                    <div className="flex items-center gap-4">
                        {/* Harmonic Neural Stream - Elegant & High-Speed */}
                        <div className="flex items-center gap-[3px] h-6 px-1">
                            {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => {
                                // Bell curve for height (middle is taller)
                                const centerDist = Math.abs(i - 5.5);
                                const heightScale = Math.max(0.3, 1 - (centerDist / 6));
                                const maxH = 6 + 18 * heightScale; // Middle ~24px, Sides ~8px
                                
                                return (
                                    <motion.div
                                        key={i}
                                        className="w-[2px] rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.3)]"
                                        initial={{ height: 4, opacity: 0.3 }}
                                        animate={{ 
                                            height: [6, maxH, 6],
                                            opacity: [0.3, 1, 0.3],
                                        }}
                                        transition={{
                                            duration: 0.5,
                                            repeat: Infinity,
                                            delay: i * 0.04, // Perfectly timed propagation
                                            ease: "easeInOut"
                                        }}
                                    />
                                );
                            })}
                        </div>
                    </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Input Area */}
      <div className="p-4 pb-6">
        <div className="max-w-3xl mx-auto">
          <div 
            className={cn(
              "bg-white dark:bg-gray-800 rounded-[20px]",
              "border border-gray-200 dark:border-gray-700",
              "transition-all duration-200"
            )}
          >
            <div className="flex flex-col">
              <div className="relative px-4 pt-4">
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={
                      !selectedModel 
                        ? "Please select a model to start chat..." 
                        : isLoading 
                            ? "AI is thinking..." 
                            : "从任何想法开始… 按 Ctrl+Enter 换行..."
                  }
                  rows={1}
                  disabled={isLoading || !selectedModel}
                  className={cn(
                    "w-full resize-none bg-transparent",
                    "text-[var(--neko-text-primary)] placeholder:text-gray-400 dark:placeholder:text-gray-500",
                    "focus:outline-none",
                    "text-sm leading-6",
                    "disabled:opacity-50 disabled:cursor-not-allowed"
                  )}
                  style={{
                    minHeight: '46px',
                    maxHeight: '320px',
                  }}
                />
              </div>

              <div className="flex items-center justify-between px-3 py-2">
                <div className="flex items-center gap-1">
                  <ModelSelector />
                  
                  <button
                    className={cn(
                      "w-9 h-9 flex items-center justify-center rounded-lg",
                      "text-gray-600 dark:text-gray-400",
                      "hover:bg-gray-100 dark:hover:bg-gray-700",
                      "transition-colors"
                    )}
                    title="附加文件"
                  >
                    <MdAttachFile className="w-5 h-5" />
                  </button>

                  <button
                    className={cn(
                      "w-9 h-9 flex items-center justify-center rounded-lg",
                      "text-gray-600 dark:text-gray-400",
                      "hover:bg-gray-100 dark:hover:bg-gray-700",
                      "transition-colors"
                    )}
                    title="添加图片"
                  >
                    <MdImage className="w-5 h-5" />
                  </button>

                  <button
                    onClick={() => {
                      const event = new CustomEvent('open-settings', { detail: { tab: 'ai' } })
                      window.dispatchEvent(event)
                    }}
                    className={cn(
                      "w-9 h-9 flex items-center justify-center rounded-lg",
                      "text-gray-600 dark:text-gray-400",
                      "hover:bg-gray-100 dark:hover:bg-gray-700",
                      "transition-colors"
                    )}
                    title="AI 设置"
                  >
                    <MdSettings className="w-5 h-5" />
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSend}
                    disabled={!message.trim() || isLoading || !selectedModel}
                    className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center",
                      "transition-all duration-200",
                      message.trim() && selectedModel && !isLoading
                        ? "bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                        : "bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed"
                    )}
                    title="发送消息"
                  >
                    <MdSend className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
