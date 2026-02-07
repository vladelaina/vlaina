import { useState, useRef, useEffect, useCallback } from 'react';
import { MdContentCopy, MdVolumeUp, MdRefresh, MdNavigateBefore, MdNavigateNext, MdStop, MdPlayArrow, MdAutoAwesome } from 'react-icons/md';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useAIStore } from '@/stores/useAIStore';
import { newAPIClient } from '@/lib/ai/providers/newapi';
import { MarkdownRenderer } from './MarkdownRenderer';
import { ChatInput } from './ChatInput';
import '@/components/Notes/features/Editor/styles/core.css';

export function ChatView() {
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
  
  // Optimized Scroll: Only scroll when new message added or loading changes
  useEffect(() => {
      if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
  }, [messages.length, isLoading]);

  // Clean up TTS on unmount
  useEffect(() => {
      return () => {
          window.speechSynthesis.cancel();
      };
  }, []);

  const handleSend = useCallback(async (text: string) => {
    if (!text.trim() || !selectedModel) return;

    const provider = providers.find(p => p.id === selectedModel.providerId);
    if (!provider) {
      setError('Provider not found');
      return;
    }

    const userMessage = text.trim();
    
    let activeSessionId = currentSessionId;
    if (!activeSessionId) {
        // Sync createSession is fine, store updates
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

    // Use current messages + new user message for history
    // Note: 'messages' here is from closure, but since we just added to store, 
    // and we need to pass history to API.
    // Ideally we fetch fresh state, but for now passing current messages is ok 
    // as newAPIClient appends the prompt.
    // Wait, if we just added to store, 'messages' variable in this closure is STALE (doesn't have new msgs).
    // This is GOOD. newAPIClient expects history BEFORE the prompt.
    // AND it expects the prompt argument.
    
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
  }, [currentSessionId, createSession, addMessage, updateMessage, completeMessage, selectedModel, providers, setLoading, setError, messages]);

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
                    {/* High-Vibe Elastic (Original Blue) */}
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
        isLoading={isLoading} 
        selectedModel={selectedModel} 
        onOpenSettings={handleOpenSettings}
      />
    </div>
  );
}