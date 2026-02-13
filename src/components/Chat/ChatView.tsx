import { useState, useRef, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAIStore } from '@/stores/useAIStore';
import { useUnifiedStore } from '@/stores/useUnifiedStore'; // Added
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
    sessions,
    messages: allMessages, 
    currentSessionId, 
    switchSession,
    switchMessageVersion, 
    selectedModel,
    models,
    selectModel,
    isSessionLoading
  } = useAIStore();

  const loaded = useUnifiedStore(s => s.loaded); // Use source of truth for loading state

  const messages = currentSessionId ? (allMessages[currentSessionId] || []) : [];
  
  // Ensure messages are loaded when session ID exists (e.g. after refresh)
  useEffect(() => {
      if (currentSessionId && allMessages[currentSessionId] === undefined) {
          switchSession(currentSessionId);
      }
  }, [currentSessionId, allMessages, switchSession]);

  const { sendMessage, regenerate, editMessage, stop } = useChatService();
  
  const isSessionActive = currentSessionId ? isSessionLoading(currentSessionId) : false;
  const lastMessage = messages[messages.length - 1];
  const showLoading = isSessionActive && (
      lastMessage?.role === 'user' || 
      (lastMessage?.role === 'assistant' && (!lastMessage.content || !lastMessage.content.trim()))
  );
  
  // If we have a valid session ID, treat it as non-empty (bottom layout) immediately.
  // Only show centered layout when strictly in "New Chat" mode (no session ID).
  const sessionExists = currentSessionId ? sessions.some(s => s.id === currentSessionId) : false;
  const isEmpty = !sessionExists;

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
      // Auto-focus input whenever session changes or on initial mount
      setFocusInputTrigger(n => n + 1);
      prevSessionIdRef.current = currentSessionId;
  }, [currentSessionId]);

  useChatShortcuts({
      onFocusInput: () => setFocusInputTrigger(n => n + 1),
      onToggleShortcuts: () => setIsShortcutsOpen(prev => !prev),
      scrollRef: containerRef 
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

  const handleSend = useCallback((text: string, attachments: Attachment[]) => {
      handleNewUserMessage();
      sendMessage(text, attachments);
  }, [handleNewUserMessage, sendMessage]);

  // Wait for store to be ready before rendering ANY layout to prevent initial jump
  if (!loaded) return null;

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
              
              <div style={{ height: spacerHeight }} aria-hidden="true" />
            </div>
          )}
        </div>
      </div>

      {/* Input section - Using static div instead of motion.div for the main container to avoid slide animations */}
      <div 
          className={cn(
              "w-full z-10 flex flex-col",
              isEmpty ? "flex-1 justify-center items-center" : "flex-none pb-6"
          )}
      >
          <AnimatePresence mode="wait">
            {isEmpty && (
                <motion.div 
                    key="welcome"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="mb-5 text-center"
                >
                    <h1 className="text-3xl font-bold text-black dark:text-white select-none tracking-tight">
                        Ciallo~(∠・ω&lt;)⌒★
                    </h1>
                </motion.div>
            )}
          </AnimatePresence>

          <div 
            className="w-full max-w-[850px] mx-auto px-4 pointer-events-auto"
          >
              <ChatInput 
                onSend={handleSend} 
                onStop={stop}
                isLoading={isSessionActive} 
                selectedModel={selectedModel} 
                focusTrigger={focusInputTrigger}
              />
          </div>
      </div>
      
      <ChatShortcutsDialog 
        isOpen={isShortcutsOpen} 
        onOpenChange={setIsShortcutsOpen} 
      />
    </div>
  );
}
