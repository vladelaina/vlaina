import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { actions as aiActions } from '@/stores/useAIStore';
import { useAIUIStore } from '@/stores/ai/chatState';
import { useUnifiedStore } from '@/stores/unified/useUnifiedStore';
import { useChatService } from '@/hooks/useChatService';
import { useMessageAutoscroll } from '@/hooks/useMessageAutoscroll';
import { useChatShortcuts } from './hooks/useChatShortcuts';
import { useComposerClickFocus } from './hooks/useComposerClickFocus';
import { useStableChatMessageDerivatives } from './hooks/useStableChatMessageDerivatives';
import { cn } from '@/lib/utils';
import { Attachment } from '@/lib/storage/attachmentStorage';
import { focusComposerInput, insertTextIntoComposer } from '@/lib/ui/composerFocusRegistry';
import { copyMessageContentToClipboard } from '@/components/Chat/common/messageClipboard';
import { isEventInsideDialog } from '@/lib/shortcuts/dialogGuards';
import type { NoteMentionReference } from '@/lib/ai/noteMentions';
import { useUIStore } from '@/stores/uiSlice';
import { useHeldPageScroll } from '@/hooks/useHeldPageScroll';

import { ChatInput } from '@/components/Chat/features/Input/ChatInput';
import { MessageList } from '@/components/Chat/features/Messages/MessageList';
import { SelectionInsertButton } from '@/components/Chat/features/Messages/components/SelectionInsertButton';
import { WelcomeScreen } from '@/components/Chat/layout/WelcomeScreen';
import { ChatShortcutsDialog } from '@/components/Chat/common/ChatShortcutsDialog';
import { TemporaryChatToggle } from '@/components/Chat/features/Temporary/TemporaryChatToggle';
import { useTemporaryTogglePresentation } from '@/components/Chat/features/Temporary/useTemporaryTogglePresentation';
import { estimateChatLoadingHeight } from '@/components/Chat/features/Layout/chatMessageLayout';

interface ChatViewProps {
  mode?: 'full' | 'embedded';
  active?: boolean;
}

const EMPTY_MESSAGES: never[] = [];

export function ChatView({ mode = 'full', active = true }: ChatViewProps) {
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [focusInputTrigger, setFocusInputTrigger] = useState(0); 
  const isEmbedded = mode === 'embedded';
  const currentSessionId = useAIUIStore((state) => state.currentSessionId);
  const sessions = useUnifiedStore((state) => state.data.ai?.sessions || []);
  const messages = useUnifiedStore((state) => {
    const sessionId = currentSessionId;
    if (!sessionId) {
      return EMPTY_MESSAGES;
    }

    return state.data.ai?.messages?.[sessionId] || EMPTY_MESSAGES;
  });
  const isMessagesLoaded = useUnifiedStore((state) => {
    const sessionId = currentSessionId;
    if (!sessionId) {
      return true;
    }

    if (!sessions.some((session) => session.id === sessionId)) {
      return true;
    }

    return state.data.ai?.messages?.[sessionId] !== undefined;
  });
  const providers = useUnifiedStore((s) => s.data.ai?.providers || []);
  const models = useUnifiedStore((s) => s.data.ai?.models || []);
  const selectedModelId = useUnifiedStore((s) => s.data.ai?.selectedModelId || null);

  const loaded = useUnifiedStore(s => s.loaded);
  const pendingComposerInsert = useUIStore((state) => state.pendingNotesChatComposerInsert);
  const consumePendingComposerInsert = useUIStore((state) => state.consumePendingNotesChatComposerInsert);

  const { imageGallery, sentUserMessages } = useStableChatMessageDerivatives(messages);
  const selectedModel = useMemo(() => {
    if (!selectedModelId) {
      return undefined;
    }

    const model = models.find((item) => item.id === selectedModelId);
    if (!model) {
      return undefined;
    }

    const provider = providers.find((item) => item.id === model.providerId);
    return provider?.enabled === false ? undefined : model;
  }, [models, providers, selectedModelId]);
  
  useEffect(() => {
    if (currentSessionId && !isMessagesLoaded) {
      aiActions.switchSession(currentSessionId);
    }
  }, [currentSessionId, isMessagesLoaded]);

  const { sendMessage, regenerate, editMessage, switchMessageVersion, stop } = useChatService();
  const regenerateRef = useRef(regenerate);
  const editMessageRef = useRef(editMessage);
  const switchMessageVersionRef = useRef(switchMessageVersion);
  const currentSessionIdRef = useRef(currentSessionId);
  const imageGalleryRef = useRef(imageGallery);
  const wasActiveRef = useRef(active);
  
  const isSessionActive = useAIUIStore((state) =>
    currentSessionId ? !!state.generatingSessions[currentSessionId] : false
  );
  const lastMessage = messages[messages.length - 1];
  const showLoading = isSessionActive && (
      lastMessage?.role === 'user' ||
      (lastMessage?.role === 'assistant' && (!lastMessage.content || !lastMessage.content.trim()))
  );
  
  const isEmpty = !currentSessionId || (isMessagesLoaded && messages.length === 0);
  const { showInChatArea } = useTemporaryTogglePresentation();

  const { containerRef, handleNewUserMessage, spacerHeight } = useMessageAutoscroll({
      messages,
      isStreaming: isSessionActive,
      chatId: currentSessionId,
      showLoading,
      estimateLoadingHeight: estimateChatLoadingHeight,
  });
  useHeldPageScroll(containerRef, {
    ignoreEditableTargets: true,
  });

  const firstEnabledModel = useMemo(() => {
    const enabledProviderIds = new Set(
      providers.filter((provider) => provider.enabled !== false).map((provider) => provider.id)
    );
    return models.find((model) => enabledProviderIds.has(model.providerId));
  }, [models, providers]);
  
  useEffect(() => {
    regenerateRef.current = regenerate;
  }, [regenerate]);

  useEffect(() => {
    editMessageRef.current = editMessage;
  }, [editMessage]);

  useEffect(() => {
    switchMessageVersionRef.current = switchMessageVersion;
  }, [switchMessageVersion]);

  useEffect(() => {
    currentSessionIdRef.current = currentSessionId;
  }, [currentSessionId]);

  useEffect(() => {
    imageGalleryRef.current = imageGallery;
  }, [imageGallery]);

  useEffect(() => {
      if (!selectedModel && firstEnabledModel) {
          aiActions.selectModel(firstEnabledModel.id);
      }
  }, [firstEnabledModel, selectedModel]);

  useEffect(() => {
      setFocusInputTrigger(n => n + 1);
  }, [currentSessionId]);

  useEffect(() => {
    if (isEmbedded || !active || wasActiveRef.current) {
      wasActiveRef.current = active;
      return;
    }

    wasActiveRef.current = active;
    let secondFrameId = 0;
    const firstFrameId = requestAnimationFrame(() => {
      if (focusComposerInput()) {
        return;
      }
      setFocusInputTrigger(n => n + 1);
      secondFrameId = requestAnimationFrame(() => {
        focusComposerInput();
      });
    });

    return () => {
      cancelAnimationFrame(firstFrameId);
      if (secondFrameId) {
        cancelAnimationFrame(secondFrameId);
      }
    };
  }, [active, isEmbedded]);

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

      if (isEventInsideDialog(event.target)) {
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
  }, active && !isEmbedded);

  const copyToClipboard = useCallback((text: string) => copyMessageContentToClipboard(text), []);
  const getImageGallery = useCallback(() => imageGalleryRef.current, []);
  const handleRegenerate = useCallback((messageId: string) => {
    regenerateRef.current(messageId);
  }, []);
  const handleEdit = useCallback((messageId: string, newContent: string) => {
    editMessageRef.current(messageId, newContent);
  }, []);
  const handleSwitchVersion = useCallback((messageId: string, versionIndex: number) => {
    const sessionId = currentSessionIdRef.current;
    if (!sessionId) {
      return;
    }
    switchMessageVersionRef.current(sessionId, messageId, versionIndex);
  }, []);

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
      className="h-full w-full flex flex-col bg-[var(--vlaina-bg-primary)] relative overflow-hidden"
      onMouseDownCapture={handleChatAreaMouseDownCapture}
    >
      {showInChatArea && (
        <div className="absolute top-3 right-4 z-30 pointer-events-auto">
          <TemporaryChatToggle />
        </div>
      )}

      <MessageList 
          chatId={currentSessionId}
          messages={messages}
          getImageGallery={getImageGallery}
          isSessionActive={isSessionActive}
          showLoading={showLoading}
          isLayoutCentered={isEmpty}
          useOverlayScrollbar
          spacerHeight={spacerHeight}
          containerRef={containerRef}
          onCopy={copyToClipboard}
          onRegenerate={handleRegenerate}
          onEdit={handleEdit}
          onSwitchVersion={handleSwitchVersion}
      />

      <div 
          className={cn(
              "w-full z-10 flex flex-col",
              isEmpty ? "flex-1 justify-center items-center" : "flex-none pb-6"
          )}
      >
          {isEmpty ? <WelcomeScreen /> : null}

          <div 
            className="w-full max-w-[850px] mx-auto px-4 pointer-events-auto"
          >
              <ChatInput 
                onSend={handleSend} 
                onStop={stop}
                isLoading={isSessionActive} 
                hasSelectedModel={!!selectedModel}
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
