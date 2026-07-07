import { useState, useEffect, useCallback } from 'react';
import { AnimatePresence } from 'framer-motion';
import { actions as aiActions } from '@/stores/useAIStore';
import { useAIUIStore } from '@/stores/ai/chatState';
import { useUnifiedStore } from '@/stores/unified/useUnifiedStore';
import { useChatService } from '@/hooks/useChatService';
import { useMessageAutoscroll } from '@/hooks/useMessageAutoscroll';
import { useChatShortcuts } from './hooks/useChatShortcuts';
import { useComposerClickFocus } from './hooks/useComposerClickFocus';
import { useChatEmbeddedSidebar } from './hooks/useChatEmbeddedSidebar';
import { useChatViewFocusLifecycle } from './hooks/useChatViewFocusLifecycle';
import { useStableChatMessageDerivatives } from './hooks/useStableChatMessageDerivatives';
import { useChatViewMessageActions } from './hooks/useChatViewMessageActions';
import { useChatViewModelSelection } from './hooks/useChatViewModelSelection';
import { useEmbeddedComposerInsert } from './hooks/useEmbeddedComposerInsert';
import { cn } from '@/lib/utils';
import type { Attachment } from '@/lib/storage/attachmentStorage';
import { focusComposerInput } from '@/lib/ui/composerFocusRegistry';
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
import { useManagedAIStore } from '@/stores/useManagedAIStore';
import { ChatEmbeddedHeader } from './ChatEmbeddedHeader';
import { ChatEmbeddedSidebarOverlay } from './ChatEmbeddedSidebarOverlay';
import { EMPTY_MESSAGES, EMPTY_MODELS, EMPTY_PROVIDERS, EMPTY_SESSIONS, type ChatViewProps } from './ChatViewState';

export function ChatView({
  mode = 'full',
  active = true,
  onCloseEmbeddedPanel,
  onPromoteEmbeddedPanel,
  onStartupReady,
  onPrimaryContentReady,
}: ChatViewProps) {
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [focusInputTrigger, setFocusInputTrigger] = useState(0); 
  const isEmbedded = mode === 'embedded';
  const currentSessionId = useAIUIStore((state) => state.currentSessionId);
  const sessions = useUnifiedStore((state) => state.data.ai?.sessions || EMPTY_SESSIONS);
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
  const providers = useUnifiedStore((s) => s.data.ai?.providers || EMPTY_PROVIDERS);
  const models = useUnifiedStore((s) => s.data.ai?.models || EMPTY_MODELS);
  const selectedModelId = useUnifiedStore((s) => s.data.ai?.selectedModelId || null);
  const managedBudget = useManagedAIStore((state) => state.budget);

  const loaded = useUnifiedStore(s => s.loaded);
  const pendingComposerInsert = useUIStore((state) => state.pendingNotesChatComposerInsert);
  const consumePendingComposerInsert = useUIStore((state) => state.consumePendingNotesChatComposerInsert);

  const { imageGallery, sentUserMessages } = useStableChatMessageDerivatives(messages);
  const { isSelectedManagedQuotaExhausted, selectedModel } = useChatViewModelSelection({
    managedBudget,
    models,
    providers,
    selectedModelId,
  });
  
  useEffect(() => {
    if (currentSessionId && !isMessagesLoaded) {
      aiActions.switchSession(currentSessionId);
    }
  }, [currentSessionId, isMessagesLoaded]);

  const {
    sendMessage,
    regenerate,
    editMessage,
    switchMessageVersion,
    stop,
    stopAndRecallLastUserMessage,
    recalledComposerDraft,
    clearRecalledComposerDraft,
  } = useChatService();
  
  const isSessionActive = useAIUIStore((state) =>
    currentSessionId ? !!state.generatingSessions[currentSessionId] : false
  );
  const lastMessage = messages[messages.length - 1];
  const showLoading = isSessionActive && (
      lastMessage?.role === 'user' ||
      (lastMessage?.role === 'assistant' && (!lastMessage.content || !lastMessage.content.trim()))
  );
  
  const isEmpty = !currentSessionId || (isMessagesLoaded && messages.length === 0);
  const { showInChatArea, showInTitleBar } = useTemporaryTogglePresentation();
  const showEmbeddedTemporaryToggle = isEmbedded && (showInChatArea || showInTitleBar);

  const { containerRef, currentTurnTopSpacerHeight, handleNewUserMessage, spacerHeight } = useMessageAutoscroll({
      active,
      messages,
      isStreaming: isSessionActive,
      chatId: currentSessionId,
      showLoading,
      estimateLoadingHeight: estimateChatLoadingHeight,
  });
  useHeldPageScroll(containerRef, {
    enabled: active,
    ignoreEditableTargets: true,
  });

  useChatViewFocusLifecycle({
    active,
    currentSessionId,
    isEmbedded,
    loaded,
    onPrimaryContentReady,
    onStartupReady,
    setFocusInputTrigger,
  });

  useEmbeddedComposerInsert({
    consumePendingComposerInsert,
    isEmbedded,
    pendingComposerInsert,
  });

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

  const {
    copyToClipboard,
    getImageGallery,
    handleEdit,
    handleFork,
    handleRegenerate,
    handleSwitchVersion,
  } = useChatViewMessageActions({
    currentSessionId,
    editMessage,
    imageGallery,
    regenerate,
    switchMessageVersion,
  });

  const handleSend = useCallback(async (text: string, attachments: Attachment[], noteMentions: NoteMentionReference[]) => {
      const accepted = await sendMessage(text, attachments, noteMentions);
      if (accepted !== false) {
        handleNewUserMessage();
      }
      return accepted;
  }, [handleNewUserMessage, sendMessage]);

  const handleChatAreaMouseDownCapture = useComposerClickFocus({
    requestFocusFallback: () => {
      setFocusInputTrigger(n => n + 1);
    }
  });

  const {
    closeEmbeddedSidebar,
    handleEmbeddedSidebarExitComplete,
    isEmbeddedSidebarOpen,
    openEmbeddedSidebar,
  } = useChatEmbeddedSidebar({
    isEmbedded,
    isSessionActive,
    stop,
  });

  if (!loaded) return null;

  return (
    <div
      data-chat-view-mode={mode}
      data-notes-block-drop-target={isEmbedded ? 'true' : undefined}
      data-file-tree-chat-drop-target={isEmbedded ? 'true' : undefined}
      className="h-full w-full flex flex-col relative overflow-hidden"
      onMouseDownCapture={handleChatAreaMouseDownCapture}
    >
      {isEmbedded && (
        <ChatEmbeddedHeader
          onCloseEmbeddedPanel={onCloseEmbeddedPanel}
          onOpenEmbeddedSidebar={openEmbeddedSidebar}
          onPromoteEmbeddedPanel={onPromoteEmbeddedPanel}
          showEmbeddedTemporaryToggle={showEmbeddedTemporaryToggle}
          showInTitleBar={showInTitleBar}
        />
      )}

      <AnimatePresence onExitComplete={handleEmbeddedSidebarExitComplete}>
        {isEmbedded && isEmbeddedSidebarOpen && (
          <ChatEmbeddedSidebarOverlay
            isOpen={isEmbeddedSidebarOpen}
            onClose={closeEmbeddedSidebar}
          />
        )}
      </AnimatePresence>

      {!isEmbedded && showInChatArea && (
        <div
          className={cn(
            "absolute right-4 z-[var(--vlaina-z-30)] translate-x-[var(--vlaina-window-resize-compensation-x)] pointer-events-auto",
            "top-3"
          )}
        >
          <TemporaryChatToggle />
        </div>
      )}

      <MessageList 
          active={active}
          chatId={currentSessionId}
          messages={messages}
          getImageGallery={getImageGallery}
          isSessionActive={isSessionActive}
          showLoading={showLoading}
          isLayoutCentered={isEmpty}
          useOverlayScrollbar
          currentTurnTopSpacerHeight={currentTurnTopSpacerHeight}
          spacerHeight={spacerHeight}
          containerRef={containerRef}
          onCopy={copyToClipboard}
          onFork={handleFork}
          onRegenerate={handleRegenerate}
          onEdit={handleEdit}
          onSwitchVersion={handleSwitchVersion}
      />

      <div 
          data-chat-input-region="true"
          className={cn(
              "w-full z-[var(--vlaina-z-10)] flex flex-col",
              isEmpty ? "flex-1 justify-center items-center" : "flex-none pb-6"
          )}
      >
          {isEmpty ? <WelcomeScreen /> : null}

          <div 
            className="w-full max-w-[var(--vlaina-size-850px)] mx-auto px-4 pointer-events-auto"
          >
              <ChatInput 
                active={active}
                onSend={handleSend} 
                onStop={stop}
                onStopAndRecall={stopAndRecallLastUserMessage}
                recalledDraft={recalledComposerDraft}
                onRecalledDraftConsumed={clearRecalledComposerDraft}
                isLoading={isSessionActive} 
                hasSelectedModel={!!selectedModel}
                isManagedQuotaExhausted={isSelectedManagedQuotaExhausted}
                focusTrigger={focusInputTrigger}
                sessionId={currentSessionId}
                sentUserMessages={sentUserMessages}
                acceptNotesBlockDrop={isEmbedded}
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
