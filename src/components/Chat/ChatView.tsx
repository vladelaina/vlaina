import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
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
import { blurComposerInput, focusComposerInput, insertTextIntoComposer } from '@/lib/ui/composerFocusRegistry';
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
import { ChatSidebar } from '@/components/Chat/features/Sidebar/ChatSidebar';
import { ModelSelector } from '@/components/Chat/features/Input/ModelSelector';
import { Icon } from '@/components/ui/icons';
import { chatComposerGhostIconButtonClass, chatComposerPillSurfaceClass } from '@/components/Chat/features/Input/composerStyles';
import { useI18n } from '@/lib/i18n';
import { themeChatLayoutTokens, themeIconTokens, themeMotionTokens, themeStyleResetTokens } from '@/styles/themeTokens';
import { isManagedProviderId } from '@/lib/ai/managedService';
import { isManagedBudgetExhausted } from '@/lib/ai/managedQuota';
import { useManagedAIStore } from '@/stores/useManagedAIStore';

interface ChatViewProps {
  mode?: 'full' | 'embedded';
  active?: boolean;
  onCloseEmbeddedPanel?: () => void;
  onPromoteEmbeddedPanel?: () => void;
  onStartupReady?: () => void;
  onPrimaryContentReady?: () => void;
}

const EMPTY_MESSAGES: never[] = [];
const EMPTY_SESSIONS: never[] = [];
const EMPTY_PROVIDERS: never[] = [];
const EMPTY_MODELS: never[] = [];

export function ChatView({
  mode = 'full',
  active = true,
  onCloseEmbeddedPanel,
  onPromoteEmbeddedPanel,
  onStartupReady,
  onPrimaryContentReady,
}: ChatViewProps) {
  const { t } = useI18n();
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isEmbeddedSidebarOpen, setIsEmbeddedSidebarOpen] = useState(false);
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
  const isSelectedManagedQuotaExhausted = Boolean(
    selectedModel &&
    isManagedProviderId(selectedModel.providerId) &&
    isManagedBudgetExhausted(managedBudget)
  );
  
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
  const regenerateRef = useRef(regenerate);
  const editMessageRef = useRef(editMessage);
  const switchMessageVersionRef = useRef(switchMessageVersion);
  const currentSessionIdRef = useRef(currentSessionId);
  const imageGalleryRef = useRef(imageGallery);
  const wasActiveRef = useRef(active);
  const embeddedSidebarFocusFrameRef = useRef<number | null>(null);
  const focusComposerAfterEmbeddedSidebarExitRef = useRef(false);

  useEffect(() => {
    if (!active) return;
    onStartupReady?.();
    if (loaded) {
      onPrimaryContentReady?.();
    }
  }, [active, loaded, onPrimaryContentReady, onStartupReady]);
  
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

  const { containerRef, handleNewUserMessage, spacerHeight } = useMessageAutoscroll({
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
    if (!isEmbedded || !isEmbeddedSidebarOpen) {
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
      setIsEmbeddedSidebarOpen(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isEmbedded, isEmbeddedSidebarOpen]);

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
        consumePendingComposerInsert(pendingComposerInsert.id);
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
  const handleFork = useCallback((messageId: string) => {
    const sessionId = currentSessionIdRef.current;
    if (!sessionId) {
      return;
    }
    aiActions.forkSessionFromMessage(sessionId, messageId);
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

  const openEmbeddedSidebar = useCallback(() => {
    focusComposerAfterEmbeddedSidebarExitRef.current = false;
    if (embeddedSidebarFocusFrameRef.current !== null) {
      cancelAnimationFrame(embeddedSidebarFocusFrameRef.current);
      embeddedSidebarFocusFrameRef.current = null;
    }
    blurComposerInput();
    setIsEmbeddedSidebarOpen(true);
  }, []);

  const closeEmbeddedSidebar = useCallback(() => {
    focusComposerAfterEmbeddedSidebarExitRef.current = true;
    setIsEmbeddedSidebarOpen(false);
  }, []);

  const handleEmbeddedSidebarExitComplete = useCallback(() => {
    if (!focusComposerAfterEmbeddedSidebarExitRef.current) {
      return;
    }
    focusComposerAfterEmbeddedSidebarExitRef.current = false;
    if (embeddedSidebarFocusFrameRef.current !== null) {
      cancelAnimationFrame(embeddedSidebarFocusFrameRef.current);
    }
    embeddedSidebarFocusFrameRef.current = requestAnimationFrame(() => {
      embeddedSidebarFocusFrameRef.current = null;
      focusComposerInput();
    });
  }, []);

  useEffect(() => {
    return () => {
      focusComposerAfterEmbeddedSidebarExitRef.current = false;
      if (embeddedSidebarFocusFrameRef.current !== null) {
        cancelAnimationFrame(embeddedSidebarFocusFrameRef.current);
        embeddedSidebarFocusFrameRef.current = null;
      }
    };
  }, []);

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
        <div className="relative z-[var(--vlaina-z-20)] flex h-10 flex-none items-center gap-2 bg-transparent px-3">
          <button
            type="button"
            aria-label={t('chat.openChatSidebar')}
            onPointerDown={(event) => {
              event.preventDefault();
              openEmbeddedSidebar();
            }}
            className={cn(
              "group flex h-8 w-8 cursor-pointer items-center justify-center text-[var(--vlaina-sidebar-chat-text)]",
              chatComposerGhostIconButtonClass
            )}
          >
            {/* Sidebar glyph adapted from Lucide Icons (ISC). */}
            <svg
              aria-hidden="true"
              focusable="false"
              xmlns="http://www.w3.org/2000/svg"
              width="24"
              height="24"
              fill={themeStyleResetTokens.fillNone}
              viewBox={themeIconTokens.viewBoxDefault}
              stroke={themeStyleResetTokens.currentColor}
              strokeWidth={themeIconTokens.strokeDefault}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="lucide lucide-text-align-start-icon lucide-text-align-start size-5 group-hover:hidden"
            >
              <path d="M21 5H3" />
              <path d="M15 12H3" />
              <path d="M17 19H3" />
            </svg>
            <Icon name="nav.expand" size="titlebarToggle" className="hidden group-hover:block" />
          </button>

          <div className="min-w-0">
            <ModelSelector
              dropdownPlacement="bottom"
              dropdownAlign="right"
              isEmbedded
            />
          </div>

          <div className="ml-auto flex h-8 items-center gap-1">
            {showEmbeddedTemporaryToggle && (
              <TemporaryChatToggle mode={showInTitleBar ? 'promote' : 'toggle'} />
            )}
            {onPromoteEmbeddedPanel && (
              <button
                type="button"
                aria-label={t('notes.rightChat')}
                onPointerDown={(event) => {
                  event.preventDefault();
                  onPromoteEmbeddedPanel();
                }}
                className={cn(
                  "flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-[var(--vlaina-sidebar-chat-text)] transition-colors hover:text-[var(--vlaina-accent)]",
                  chatComposerPillSurfaceClass
                )}
              >
                <Icon name="nav.panelRight" size="md" />
              </button>
            )}
            {onCloseEmbeddedPanel && (
              <button
                type="button"
                aria-label={t('chat.closeChatPanel')}
                onPointerDown={(event) => {
                  event.preventDefault();
                  onCloseEmbeddedPanel();
                }}
                className={cn(
                  "flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-[var(--vlaina-sidebar-chat-text)] transition-colors hover:text-[var(--vlaina-sidebar-row-selected-text)]",
                  chatComposerPillSurfaceClass
                )}
              >
                <Icon name="nav.chevronRight" size="md" />
              </button>
            )}
          </div>
        </div>
      )}

      <AnimatePresence onExitComplete={handleEmbeddedSidebarExitComplete}>
        {isEmbedded && isEmbeddedSidebarOpen && (
          <div
            className="absolute inset-0 z-[var(--vlaina-z-40)]"
            aria-hidden={!isEmbeddedSidebarOpen}
            onMouseDownCapture={(event) => event.stopPropagation()}
          >
            <motion.button
              type="button"
              aria-label={t('chat.closeChatSidebar')}
              className="absolute inset-0 h-full w-full bg-[var(--vlaina-color-overlay-weak)]"
              initial={{ opacity: themeMotionTokens.opacityHidden }}
              animate={{ opacity: themeMotionTokens.opacityVisible }}
              exit={{ opacity: themeMotionTokens.opacityHidden }}
              transition={{
                duration: themeMotionTokens.chatEmbeddedOverlayDuration,
                ease: themeMotionTokens.standardEase,
              }}
              onPointerDown={(event) => {
                event.preventDefault();
                closeEmbeddedSidebar();
              }}
            />
            <motion.div
              className="relative h-full transform-gpu overflow-hidden rounded-r-[var(--vlaina-chat-embedded-sidebar-radius)] shadow-[var(--vlaina-shadow-none)] will-change-transform"
              style={{ width: themeChatLayoutTokens.embeddedSidebarWidth }}
              initial={{ x: themeMotionTokens.chatEmbeddedSidebarHiddenX }}
              animate={{ x: themeMotionTokens.chatEmbeddedSidebarVisibleX }}
              exit={{ x: themeMotionTokens.chatEmbeddedSidebarHiddenX }}
              transition={{
                type: 'spring',
                stiffness: themeMotionTokens.chatEmbeddedSidebarSpringStiffness,
                damping: themeMotionTokens.chatEmbeddedSidebarSpringDamping,
                mass: themeMotionTokens.chatEmbeddedSidebarSpringMass,
              }}
            >
              <ChatSidebar embedded onRequestClose={closeEmbeddedSidebar} />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {!isEmbedded && showInChatArea && (
        <div className={cn(
          "absolute right-4 z-[var(--vlaina-z-30)] pointer-events-auto",
          "top-3"
        )}>
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
