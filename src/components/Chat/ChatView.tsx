import { useState, useRef, useEffect, useCallback } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useAIStore } from '@/stores/useAIStore';
import { useUnifiedStore } from '@/stores/useUnifiedStore';
import { useChatService } from '@/hooks/useChatService';
import { useMessageAutoscroll } from '@/hooks/useMessageAutoscroll';
import { useChatShortcuts } from './hooks/useChatShortcuts';
import { cn } from '@/lib/utils';
import { Attachment } from '@/lib/storage/attachmentStorage';

import { ChatInput } from '@/components/Chat/features/Input/ChatInput';
import { MessageList } from '@/components/Chat/features/Messages/MessageList';
import { WelcomeScreen } from '@/components/Chat/layout/WelcomeScreen';
import { ChatShortcutsDialog } from '@/components/Chat/common/ChatShortcutsDialog';

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

  const loaded = useUnifiedStore(s => s.loaded);

  const messages = currentSessionId ? (allMessages[currentSessionId] || []) : [];
  
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
  
  const sessionExists = currentSessionId ? sessions.some(s => s.id === currentSessionId) : false;
  const isMessagesLoaded = currentSessionId && sessionExists ? allMessages[currentSessionId] !== undefined : true;

  const isEmpty = !currentSessionId || (isMessagesLoaded && messages.length === 0);

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

  if (!loaded) return null;

  return (
    <div className="h-full w-full flex flex-col bg-[var(--neko-bg-primary)] relative overflow-hidden">
      
      <MessageList 
          messages={messages}
          isSessionActive={isSessionActive}
          showLoading={showLoading}
          isLayoutCentered={isEmpty}
          spacerHeight={spacerHeight}
          containerRef={containerRef}
          speakingMsgId={speakingMsgId}
          expandedSources={expandedSources}
          onCopy={copyToClipboard}
          onSpeak={handleSpeak}
          onRegenerate={regenerate}
          onEdit={editMessage}
          onSwitchVersion={(msgId, idx) => currentSessionId && switchMessageVersion(currentSessionId, msgId, idx)}
          onToggleSources={toggleSources}
      />

      <div 
          className={cn(
              "w-full z-10 flex flex-col",
              isEmpty ? "flex-1 justify-center items-center" : "flex-none pb-6"
          )}
      >
          <AnimatePresence mode="wait">
            {isEmpty && <WelcomeScreen />}
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
