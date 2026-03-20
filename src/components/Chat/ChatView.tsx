import { useState, useEffect, useCallback, useMemo } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useAIStore } from '@/stores/useAIStore';
import { useUnifiedStore } from '@/stores/unified/useUnifiedStore';
import { useChatService } from '@/hooks/useChatService';
import { useMessageAutoscroll } from '@/hooks/useMessageAutoscroll';
import { useChatShortcuts } from './hooks/useChatShortcuts';
import { useComposerClickFocus } from './hooks/useComposerClickFocus';
import { cn } from '@/lib/utils';
import { Attachment } from '@/lib/storage/attachmentStorage';
import { focusComposerInput, insertTextIntoComposer } from '@/lib/ui/composerFocusRegistry';
import { copyMessageContentToClipboard } from '@/components/Chat/common/messageClipboard';
import { extractMessageImageSources } from '@/components/Chat/common/messageClipboard';
import type { NoteMentionReference } from '@/lib/ai/noteMentions';
import { useUIStore } from '@/stores/uiSlice';

import { ChatInput } from '@/components/Chat/features/Input/ChatInput';
import { MessageList } from '@/components/Chat/features/Messages/MessageList';
import { SelectionInsertButton } from '@/components/Chat/features/Messages/components/SelectionInsertButton';
import { WelcomeScreen } from '@/components/Chat/layout/WelcomeScreen';
import { ChatShortcutsDialog } from '@/components/Chat/common/ChatShortcutsDialog';
import { TemporaryChatToggle } from '@/components/Chat/features/Temporary/TemporaryChatToggle';
import { useTemporaryTogglePresentation } from '@/components/Chat/features/Temporary/useTemporaryTogglePresentation';

interface ChatImageGalleryItem {
  id: string;
  src: string;
}

interface ChatViewProps {
  mode?: 'full' | 'embedded';
}

export function ChatView({ mode = 'full' }: ChatViewProps) {
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [focusInputTrigger, setFocusInputTrigger] = useState(0); 
  const isEmbedded = mode === 'embedded';

  const { 
    sessions,
    messages: allMessages, 
    currentSessionId, 
    switchSession,
    switchMessageVersion, 
    providers,
    selectedModel,
    models,
    selectModel,
    isSessionLoading,
  } = useAIStore();

  const loaded = useUnifiedStore(s => s.loaded);
  const pendingComposerInsert = useUIStore((state) => state.pendingNotesChatComposerInsert);
  const consumePendingComposerInsert = useUIStore((state) => state.consumePendingNotesChatComposerInsert);

  const messages = currentSessionId ? (allMessages[currentSessionId] || []) : [];
  const imageGallery = useMemo<ChatImageGalleryItem[]>(
    () =>
      messages.flatMap((message) =>
        message.role === 'assistant'
          ? (message.imageSources && message.imageSources.length > 0
              ? message.imageSources
              : extractMessageImageSources(message.content || '')
            ).map((src, index) => ({
              id: `${message.id}:${index}`,
              src,
            }))
          : []
      ),
    [messages]
  );

  useEffect(() => {
    if (!import.meta.env.DEV) {
      return;
    }

    const assistantMessages = messages
      .filter((message) => message.role === 'assistant')
      .map((message) => ({
        id: message.id,
        imageSources: message.imageSources || [],
        extractedImageSources: extractMessageImageSources(message.content || ''),
        contentPreview: (message.content || '').slice(0, 180),
      }))
      .filter(
        (message) =>
          message.imageSources.length > 0 || message.extractedImageSources.length > 0
      );

    if (imageGallery.length === 0 && assistantMessages.length === 0) {
      return;
    }

    console.log('[chat-image-nav] conversation gallery', {
      sessionId: currentSessionId,
      gallerySize: imageGallery.length,
      gallery: imageGallery,
      assistantMessages,
    });
  }, [currentSessionId, imageGallery, messages]);

  const sentUserMessages = useMemo(
    () =>
      messages
        .filter((msg) => msg.role === 'user')
        .map((msg) => msg.content)
        .filter((content) => content.trim().length > 0),
    [messages]
  );
  
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
  const { showInChatArea } = useTemporaryTogglePresentation();

  const { containerRef, handleNewUserMessage, spacerHeight } = useMessageAutoscroll({
      messages,
      isStreaming: isSessionActive,
      chatId: currentSessionId
  });

  const firstEnabledModel = useMemo(() => {
    const enabledProviderIds = new Set(
      providers.filter((provider) => provider.enabled !== false).map((provider) => provider.id)
    );
    return models.find((model) => enabledProviderIds.has(model.providerId));
  }, [models, providers]);
  
  useEffect(() => {
      if (!selectedModel && firstEnabledModel) {
          selectModel(firstEnabledModel.id);
      }
  }, [firstEnabledModel, selectedModel, selectModel]);

  useEffect(() => {
      setFocusInputTrigger(n => n + 1);
  }, [currentSessionId]);

  useEffect(() => {
    if (!isEmbedded || !isSessionActive) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key !== 'Escape' ||
        event.shiftKey ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey
      ) {
        return;
      }

      if (
        event.target instanceof Element &&
        event.target.closest('[role="dialog"], [aria-modal="true"]')
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      stop();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isEmbedded, isSessionActive, stop]);

  useEffect(() => {
    if (!isEmbedded || !pendingComposerInsert) {
      return;
    }

    let frameId = 0;
    let attempts = 0;
    let cancelled = false;

    const tryInsert = () => {
      if (cancelled) {
        return;
      }

      if (insertTextIntoComposer(pendingComposerInsert.text)) {
        focusComposerInput();
        consumePendingComposerInsert(pendingComposerInsert.id);
        return;
      }

      attempts += 1;
      if (attempts >= 24) {
        return;
      }

      frameId = requestAnimationFrame(tryInsert);
    };

    tryInsert();

    return () => {
      cancelled = true;
      if (frameId) {
        cancelAnimationFrame(frameId);
      }
    };
  }, [consumePendingComposerInsert, isEmbedded, pendingComposerInsert]);

  useChatShortcuts({
    onFocusInput: () => {
      if (!focusComposerInput()) {
        setFocusInputTrigger(n => n + 1);
      }
    },
    onToggleShortcuts: () => setIsShortcutsOpen(prev => !prev),
    onStopGeneration: stop,
    isGenerating: isSessionActive,
    scrollRef: containerRef,
  }, !isEmbedded);

  const copyToClipboard = useCallback((text: string) => copyMessageContentToClipboard(text), []);

  const handleSend = useCallback((text: string, attachments: Attachment[], noteMentions: NoteMentionReference[]) => {
      handleNewUserMessage();
      sendMessage(text, attachments, noteMentions);
  }, [handleNewUserMessage, sendMessage]);

  const handleChatAreaMouseDownCapture = useComposerClickFocus({
    requestFocusFallback: () => {
      setFocusInputTrigger(n => n + 1);
    }
  });

  if (!loaded) return null;

  return (
    <div
      data-chat-view-mode={mode}
      className="h-full w-full flex flex-col bg-[var(--neko-bg-primary)] relative overflow-hidden"
      onMouseDownCapture={handleChatAreaMouseDownCapture}
    >
      {showInChatArea && !isEmbedded && (
        <div className="absolute top-3 right-4 z-30 pointer-events-auto">
          <TemporaryChatToggle />
        </div>
      )}

      <MessageList 
          messages={messages}
          imageGallery={imageGallery}
          isSessionActive={isSessionActive}
          showLoading={showLoading}
          isLayoutCentered={isEmpty}
          spacerHeight={spacerHeight}
          containerRef={containerRef}
          onCopy={copyToClipboard}
          onRegenerate={regenerate}
          onEdit={editMessage}
          onSwitchVersion={(msgId, idx) => currentSessionId && switchMessageVersion(currentSessionId, msgId, idx)}
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
                sessionId={currentSessionId}
                sentUserMessages={sentUserMessages}
              />
          </div>
      </div>
      
      {!isEmbedded && (
        <ChatShortcutsDialog
          isOpen={isShortcutsOpen}
          onOpenChange={setIsShortcutsOpen}
        />
      )}
      {!isEmbedded && <SelectionInsertButton />}
    </div>
  );
}
