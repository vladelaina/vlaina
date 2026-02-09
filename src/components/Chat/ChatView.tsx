import { useState, useRef, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAIStore } from '@/stores/useAIStore';
import { useChatService } from '@/hooks/useChatService';
import { ChatInput } from './ChatInput';
import { MessageItem } from './messages/MessageItem';
import { ChatLoading } from './components/ChatLoading';
import { ChatShortcutsDialog } from './components/ChatShortcutsDialog';
import { useChatShortcuts } from './hooks/useChatShortcuts';
import { cn } from '@/lib/utils';
import '@/components/Notes/features/Editor/styles/core.css';

export function ChatView() {
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);
  const [expandedSources, setExpandedSources] = useState<Set<string>>(new Set());
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [focusInputTrigger, setFocusInputTrigger] = useState(0); 
  const scrollRef = useRef<HTMLDivElement>(null);

  const { 
    messages: allMessages, 
    currentSessionId, 
    switchMessageVersion, 
    selectedModel,
    models,
    selectModel,
    isSessionLoading
  } = useAIStore();

  const messages = currentSessionId ? (allMessages[currentSessionId] || []) : [];
  const { sendMessage, regenerate, editMessage, stop } = useChatService();
  
  const isLoading = currentSessionId ? isSessionLoading(currentSessionId) : false;
  const isEmpty = messages.length === 0;
  
  useEffect(() => {
      if (!selectedModel && models.length > 0) {
          selectModel(models[0].id);
      }
  }, [models, selectedModel, selectModel]);

  const prevSessionIdRef = useRef(currentSessionId);
  useEffect(() => {
      if (currentSessionId === null && prevSessionIdRef.current !== null) {
          setFocusInputTrigger(n => n + 1);
      }
      prevSessionIdRef.current = currentSessionId;
  }, [currentSessionId]);

  useChatShortcuts({
      onFocusInput: () => setFocusInputTrigger(n => n + 1),
      onToggleShortcuts: () => setIsShortcutsOpen(prev => !prev),
      scrollRef
  });
  
  useEffect(() => {
      if (scrollRef.current && !isEmpty) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
  }, [messages.length, isLoading, isEmpty]);

  useEffect(() => {
      return () => {
          window.speechSynthesis.cancel();
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
    <div className="h-full w-full flex flex-col bg-[var(--neko-bg-primary)] relative overflow-hidden">
      <div 
        className={cn(
            "flex-1 overflow-y-auto transition-opacity duration-500",
            isEmpty ? "opacity-0 pointer-events-none hidden" : "opacity-100"
        )}
        ref={scrollRef}
      >
        <div className="max-w-3xl mx-auto px-4 py-8 pb-4 min-h-full flex flex-col">
          {!isEmpty && (
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
                    onRegenerate={regenerate}
                    onEdit={editMessage}
                    onSwitchVersion={(msgId, idx) => currentSessionId && switchMessageVersion(currentSessionId, msgId, idx)}
                    onToggleSources={toggleSources}
                />
              ))}
              <AnimatePresence>
                {isLoading && <ChatLoading key="loading" />}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      <motion.div 
          layout
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          className={cn(
              "w-full z-10 flex flex-col",
              isEmpty ? "flex-1 justify-center items-center" : "flex-none"
          )}
      >
          <AnimatePresence>
            {isEmpty && (
                <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    transition={{ duration: 0.3 }}
                    className="mb-5 text-center"
                >
                    <h1 className="text-3xl font-bold text-black dark:text-white select-none tracking-tight">
                        Ciallo~(∠・ω&lt;)⌒★
                    </h1>
                </motion.div>
            )}
          </AnimatePresence>

          <motion.div 
            layout
            className={cn("w-full", isEmpty ? "max-w-2xl px-4" : "")}
          >
              <ChatInput 
                onSend={sendMessage} 
                onStop={stop}
                isLoading={isLoading} 
                selectedModel={selectedModel} 
                focusTrigger={focusInputTrigger}
              />
          </motion.div>
      </motion.div>
      
      <ChatShortcutsDialog 
        isOpen={isShortcutsOpen} 
        onOpenChange={setIsShortcutsOpen} 
      />
    </div>
  );
}
