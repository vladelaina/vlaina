import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import type { Attachment } from '@/lib/storage/attachmentStorage';
import type { NoteMentionReference } from '@/lib/ai/noteMentions';
import {
  chatComposerFrameClass,
  chatComposerSurfaceClass,
} from './composerStyles';
import { useChatComposer } from './hooks/useChatComposer';
import { useChatAttachments } from './hooks/useChatAttachments';
import { ChatAttachmentPreviewList } from './components/ChatAttachmentPreviewList';
import { ChatComposerField } from './components/ChatComposerField';
import { ChatInputActions } from './components/ChatInputActions';
import { NoteMentionPicker } from './components/NoteMentionPicker';
import { useChatHistoryNavigation } from './hooks/useChatHistoryNavigation';
import { useNoteMentions } from './hooks/useNoteMentions';
import { useAIStore } from '@/stores/useAIStore';
import { useI18n } from '@/lib/i18n/useI18n';
import { insertTextIntoComposer } from '@/lib/ui/composerFocusRegistry';
import {
  getBlockDragComposerPayload,
  subscribeBlockDragVisualState,
} from '@/components/Notes/features/Editor/plugins/cursor/blockDragVisualState';

interface ChatInputProps {
  active?: boolean;
  onSend: (message: string, attachments: Attachment[], noteMentions: NoteMentionReference[]) => void | boolean | Promise<void | boolean>;
  onStop: () => void;
  isLoading: boolean;
  hasSelectedModel: boolean;
  focusTrigger?: number;
  sessionId?: string | null;
  sentUserMessages: string[];
  acceptNotesBlockDrop?: boolean;
}

export const ChatInput = memo(function ChatInput({
  active = true,
  onSend,
  onStop,
  isLoading,
  hasSelectedModel,
  focusTrigger,
  sessionId,
  sentUserMessages,
  acceptNotesBlockDrop = false,
}: ChatInputProps) {
  const { t } = useI18n();
  const focusRafRef = useRef<number | null>(null);
  const restoreFocusListenerRef = useRef<(() => void) | null>(null);
  const [isBlockDropActive, setIsBlockDropActive] = useState(false);
  const { webSearchEnabled, setWebSearchEnabled } = useAIStore();
  const {
    attachments,
    isDragging,
    fileInputRef,
    handlePaste,
    handleDrop,
    handleDragEnter,
    handleDragOver,
    handleDragLeave,
    handleFileChange,
    triggerFileSelect,
    removeAttachment,
    clearAttachments,
  } = useChatAttachments();

  const {
    message,
    textareaRef,
    composerRootRef,
    markExplicitMultiline,
    handleMessageChange,
    handleSend,
    handleKeyDown,
    handleCompositionStart,
    handleCompositionEnd,
  } = useChatComposer({
    active,
    onSend: async (text, nextAttachments, nextNoteMentions) => {
      if (isLoading) {
        onStop();
      }
      return await onSend(text, nextAttachments, nextNoteMentions);
    },
    attachments,
    getNoteMentions: () => noteMentions,
    onAfterSend: () => {
      clearAttachments();
      clearNoteMentions();
    },
    canSubmit: hasSelectedModel,
    focusTrigger,
  });

  const handleTextareaPaste = useCallback(
    (e: React.ClipboardEvent) => {
      if (e.clipboardData.getData('text/plain').includes('\n')) {
        markExplicitMultiline();
      }
      void handlePaste(e);
    },
    [handlePaste, markExplicitMultiline]
  );

  const scheduleComposerFocus = useCallback((position?: number) => {
    if (focusRafRef.current !== null) {
      cancelAnimationFrame(focusRafRef.current);
    }
    focusRafRef.current = requestAnimationFrame(() => {
      focusRafRef.current = null;
      const input = textareaRef.current;
      if (!input) {
        return;
      }
      input.focus({ preventScroll: true });
      const nextPosition = position ?? input.value.length;
      input.setSelectionRange(nextPosition, nextPosition);
    });
  }, [textareaRef]);

  useEffect(() => {
    return () => {
      if (focusRafRef.current !== null) {
        cancelAnimationFrame(focusRafRef.current);
        focusRafRef.current = null;
      }
      if (restoreFocusListenerRef.current) {
        window.removeEventListener('focus', restoreFocusListenerRef.current, { capture: true });
        restoreFocusListenerRef.current = null;
      }
    };
  }, []);

  const {
    noteMentions,
    clearNoteMentions,
    currentPageCandidates,
    linkedPageCandidates,
    mentionPreviewParts,
    showMentionPicker,
    mentionPickerStatus,
    activeCandidatePath,
    textareaScrollTop,
    handleCaretChange,
    handleCaretBlur,
    handleMentionKeyDown,
    setTextareaScrollTop,
    applyMentionCandidate,
    removeNoteMention,
  } = useNoteMentions({
    message,
    textareaRef,
    handleMessageChange,
  });

  const applyHistoryMessage = useCallback(
    (nextMessage: string) => {
      if (nextMessage.includes('\n')) {
        markExplicitMultiline();
      }
      handleMessageChange(nextMessage);
      const nextCaret = nextMessage.length;
      handleCaretChange(nextCaret);
      scheduleComposerFocus(nextCaret);
    },
    [handleCaretChange, handleMessageChange, markExplicitMultiline, scheduleComposerFocus]
  );

  const {
    resetHistoryNavigation,
    clearHistoryNavigationOnInput,
    handleHistoryKeyDown,
  } = useChatHistoryNavigation({
    message,
    sentUserMessages,
    showMentionPicker,
    applyHistoryMessage,
  });

  useEffect(() => {
    resetHistoryNavigation();
  }, [resetHistoryNavigation, sessionId]);

  useEffect(() => {
    if (!acceptNotesBlockDrop || !active) {
      setIsBlockDropActive(false);
      return;
    }

    const isInsideDropTarget = (event: MouseEvent) => {
      const root = composerRootRef.current?.closest('[data-notes-block-drop-target="true"]') as HTMLElement | null;
      if (!root || !getBlockDragComposerPayload()) {
        return false;
      }
      const rect = root.getBoundingClientRect();
      return (
        event.clientX >= rect.left
        && event.clientX <= rect.right
        && event.clientY >= rect.top
        && event.clientY <= rect.bottom
      );
    };

    const syncDropActive = (event?: MouseEvent) => {
      if (!getBlockDragComposerPayload()) {
        setIsBlockDropActive(false);
        return;
      }
      if (event) {
        setIsBlockDropActive(isInsideDropTarget(event));
      }
    };

    const handleMouseMove = (event: MouseEvent) => {
      syncDropActive(event);
    };

    const handleMouseUp = (event: MouseEvent) => {
      const payload = getBlockDragComposerPayload();
      const shouldInsert = Boolean(payload?.text) && isInsideDropTarget(event);
      setIsBlockDropActive(false);
      if (!shouldInsert || !payload) {
        return;
      }

      event.preventDefault();
      insertTextIntoComposer(payload.text);
      resetHistoryNavigation();
      clearHistoryNavigationOnInput();
    };

    const unsubscribe = subscribeBlockDragVisualState(() => syncDropActive());
    window.addEventListener('mousemove', handleMouseMove, true);
    window.addEventListener('mouseup', handleMouseUp, true);

    return () => {
      unsubscribe();
      window.removeEventListener('mousemove', handleMouseMove, true);
      window.removeEventListener('mouseup', handleMouseUp, true);
      setIsBlockDropActive(false);
    };
  }, [
    acceptNotesBlockDrop,
    active,
    clearHistoryNavigationOnInput,
    composerRootRef,
    resetHistoryNavigation,
  ]);

  useEffect(() => {
    if (message.length === 0) {
      resetHistoryNavigation();
    }
  }, [message, resetHistoryNavigation]);

  const handleHiddenFileInputChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      await handleFileChange(e);
      scheduleComposerFocus();
    },
    [handleFileChange, scheduleComposerFocus]
  );

  const handleTriggerFileSelect = useCallback(() => {
    triggerFileSelect();
    if (typeof window === 'undefined') {
      return;
    }
    if (restoreFocusListenerRef.current) {
      window.removeEventListener('focus', restoreFocusListenerRef.current, { capture: true });
      restoreFocusListenerRef.current = null;
    }
    const restoreFocus = () => {
      restoreFocusListenerRef.current = null;
      scheduleComposerFocus();
    };
    restoreFocusListenerRef.current = restoreFocus;
    window.addEventListener('focus', restoreFocus, { capture: true, once: true });
  }, [scheduleComposerFocus, triggerFileSelect]);

  const handleTextareaKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const selectionStart = e.currentTarget.selectionStart ?? 0;
      const selectionEnd = e.currentTarget.selectionEnd ?? 0;

      if (handleMentionKeyDown(e)) {
        return;
      }

      if (
        handleHistoryKeyDown({
          key: e.key,
          selectionStart,
          selectionEnd,
          shiftKey: e.shiftKey,
          altKey: e.altKey,
          ctrlKey: e.ctrlKey,
          metaKey: e.metaKey,
          preventDefault: () => e.preventDefault(),
        })
      ) {
        return;
      }

      handleKeyDown(e);
    },
    [
      handleHistoryKeyDown,
      handleKeyDown,
      handleMentionKeyDown,
    ]
  );

  const canSend =
    (!!message.trim() || attachments.length > 0 || noteMentions.length > 0) &&
    hasSelectedModel;
  const canSubmit = canSend && !isLoading;
  const handleComposerChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      handleMessageChange(event.target.value);
      clearHistoryNavigationOnInput();
      handleCaretChange(event.target.selectionStart ?? event.target.value.length);
    },
    [clearHistoryNavigationOnInput, handleCaretChange, handleMessageChange]
  );

  return (
    <>
      <input
        type="file"
        spellCheck={false}
        multiple
        className="hidden"
        ref={fileInputRef}
        onChange={handleHiddenFileInputChange}
      />

      <div
        data-chat-input="true"
        ref={composerRootRef}
        className={cn(
          'relative z-10',
          chatComposerFrameClass,
          chatComposerSurfaceClass
        )}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {(isDragging || isBlockDropActive) && (
          <div
            className={cn(
              "absolute inset-0 z-20 flex items-center justify-center rounded-[32px] border-2 border-dashed backdrop-blur-sm pointer-events-none",
              isBlockDropActive
                ? "border-[var(--vlaina-color-accent)]/60 bg-[var(--vlaina-color-accent)]/[0.08] dark:border-[var(--vlaina-color-accent)]/65 dark:bg-[var(--vlaina-color-accent)]/[0.14]"
                : "border-[var(--chat-sidebar-icon)]/50 bg-black/[0.03] dark:border-white/15 dark:bg-white/[0.04]"
            )}
          >
            <span
              className={cn(
                "font-medium",
                isBlockDropActive
                  ? "text-[var(--vlaina-color-accent)]"
                  : "text-[var(--chat-sidebar-text-muted)] dark:text-[var(--chat-sidebar-text-soft)]"
              )}
            >
              {isBlockDropActive ? t('chat.dropBlocksHere') : t('chat.dropFilesHere')}
            </span>
          </div>
        )}

        <div className="flex flex-col px-1 w-full">
          {showMentionPicker && (
            <NoteMentionPicker
              currentPageCandidates={currentPageCandidates}
              linkedPageCandidates={linkedPageCandidates}
              activeCandidatePath={activeCandidatePath}
              status={mentionPickerStatus}
              onSelect={applyMentionCandidate}
            />
          )}

          <ChatAttachmentPreviewList attachments={attachments} onRemove={removeAttachment} />

          <ChatComposerField
            textareaRef={textareaRef}
            message={message}
            onChange={handleComposerChange}
            onCompositionStart={handleCompositionStart}
            onCompositionEnd={handleCompositionEnd}
            onKeyDown={handleTextareaKeyDown}
            onSelect={(e) => handleCaretChange(e.currentTarget.selectionStart ?? 0)}
            onClick={(e) => handleCaretChange(e.currentTarget.selectionStart ?? 0)}
            onBlur={handleCaretBlur}
            onPaste={handleTextareaPaste}
            onScroll={(e) => setTextareaScrollTop(e.currentTarget.scrollTop)}
            placeholder={!hasSelectedModel ? t('chat.selectModelPlaceholder') : t('chat.composerPlaceholder')}
            mentionPreviewParts={mentionPreviewParts}
            textareaScrollTop={textareaScrollTop}
            onRemoveMention={removeNoteMention}
          />

          <ChatInputActions
            onTriggerFileSelect={handleTriggerFileSelect}
            isLoading={isLoading}
            canSend={canSend}
            canSubmit={canSubmit}
            webSearchEnabled={webSearchEnabled}
            onToggleWebSearch={() => setWebSearchEnabled(!webSearchEnabled)}
            onRequestComposerFocus={scheduleComposerFocus}
            onStop={onStop}
            onSend={() => handleSend()}
          />
        </div>
      </div>
    </>
  );
});
