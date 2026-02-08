import { useState, useRef, useEffect, useCallback } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useAIStore } from '@/stores/useAIStore';
import { useChatService } from '@/hooks/useChatService';
import { ChatInput } from './ChatInput';
import { MessageItem } from './messages/MessageItem';
import { ChatLoading } from './components/ChatLoading';
import { ChatShortcutsDialog } from './components/ChatShortcutsDialog';
import { useChatShortcuts } from './hooks/useChatShortcuts';
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
    switchVersion, 
    selectedModel,
    isSessionLoading
  } = useAIStore();

  const messages = currentSessionId ? (allMessages[currentSessionId] || []) : [];
  const { sendMessage, regenerate, editMessage, stop } = useChatService();
  
  const isLoading = currentSessionId ? isSessionLoading(currentSessionId) : false;
  
  useChatShortcuts({
      onFocusInput: () => setFocusInputTrigger(n => n + 1),
      onToggleShortcuts: () => setIsShortcutsOpen(prev => !prev),
      scrollRef
  });
  
  useEffect(() => {
      if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
  }, [messages.length, isLoading]);

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
                    onRegenerate={regenerate}
                    onEdit={editMessage}
                    onSwitchVersion={switchVersion}
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

      <ChatInput 
        onSend={sendMessage} 
        onStop={stop}
        isLoading={isLoading} 
        selectedModel={selectedModel} 
        onOpenSettings={handleOpenSettings}
        focusTrigger={focusInputTrigger}
      />
      
      <ChatShortcutsDialog 
        isOpen={isShortcutsOpen} 
        onOpenChange={setIsShortcutsOpen} 
      />
    </div>
  );
}
