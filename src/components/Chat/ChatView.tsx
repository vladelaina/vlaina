import { useState, useRef, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAIStore } from '@/stores/useAIStore';
import { useChatService } from '@/hooks/useChatService';
import { useMessageAutoscroll } from '@/hooks/useMessageAutoscroll';
import { ChatInput } from './ChatInput';
import { MessageItem } from './messages/MessageItem';
import { ChatLoading } from './components/ChatLoading';
import { ChatShortcutsDialog } from './components/ChatShortcutsDialog';
import { useChatShortcuts } from './hooks/useChatShortcuts';
import { cn } from '@/lib/utils';
import '@/components/Notes/features/Editor/styles/core.css';
import { Attachment } from '@/lib/storage/attachmentStorage';

export function ChatView() {
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);
  const [expandedSources, setExpandedSources] = useState<Set<string>>(new Set());
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [focusInputTrigger, setFocusInputTrigger] = useState(0); 

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
  
  const isSessionActive = currentSessionId ? isSessionLoading(currentSessionId) : false;
  const lastMessage = messages[messages.length - 1];
  // Only show loading dots if we are waiting for the assistant's first response chunk
  // (i.e., session is loading but the last message is still from the user OR empty assistant message)
  const showLoading = isSessionActive && (
      lastMessage?.role === 'user' || 
      (lastMessage?.role === 'assistant' && (!lastMessage.content || !lastMessage.content.trim()))
  );
  
  // Only consider empty if explicitly loaded as empty array. 
  // If undefined (loading), treat as non-empty to prevent layout jumps.
  const isMessagesLoaded = currentSessionId ? allMessages[currentSessionId] !== undefined : true;
  const isEmpty = isMessagesLoaded && messages.length === 0;

  // Use the new autoscroll hook
  const { containerRef, handleNewUserMessage, spacerHeight } = useMessageAutoscroll({
      messages,
      isStreaming: isSessionActive,
      chatId: currentSessionId
  });
  
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
      scrollRef: containerRef // Pass the new ref to shortcuts
  });

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

  // Wrap sendMessage to trigger autoscroll behavior
  const handleSend = useCallback((text: string, attachments: Attachment[]) => {
      handleNewUserMessage();
      sendMessage(text, attachments);
  }, [handleNewUserMessage, sendMessage]);

  return (
    <div className="h-full w-full flex flex-col bg-[var(--neko-bg-primary)] relative overflow-hidden">
      <div 
        className={cn(
            "flex-1 overflow-y-auto transition-opacity duration-500",
            isEmpty ? "opacity-0 pointer-events-none hidden" : "opacity-100"
        )}
        ref={containerRef}
      >
        <div className="max-w-3xl mx-auto px-4 py-8 pb-4 min-h-full flex flex-col">
          {!isEmpty && (
            <div className="space-y-8">
              {messages.map((msg, idx) => (
                <div key={msg.id} data-message-index={idx}>
                    <MessageItem 
                        msg={msg}
                        isLoading={isSessionActive && idx === messages.length - 1} 
                        isSpeaking={speakingMsgId === msg.id}
                        isSourcesOpen={expandedSources.has(msg.id)}
                        onCopy={copyToClipboard}
                        onSpeak={handleSpeak}
                        onRegenerate={regenerate}
                        onEdit={editMessage}
                        onSwitchVersion={(msgId, idx) => currentSessionId && switchMessageVersion(currentSessionId, msgId, idx)}
                        onToggleSources={toggleSources}
                    />
                </div>
              ))}
              <AnimatePresence>
                {showLoading && <ChatLoading key="loading" />}
              </AnimatePresence>
              
              {/* Dynamic Spacer */}
              <div style={{ height: spacerHeight }} aria-hidden="true" />
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
            className="w-full max-w-3xl mx-auto px-4"
          >
              <ChatInput 
                onSend={handleSend} 
                onStop={stop}
                isLoading={isSessionActive} 
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