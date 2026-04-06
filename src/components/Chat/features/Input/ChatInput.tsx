import { memo, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';
import type { AIModel } from '@/lib/ai/types';
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

interface ChatInputProps {
  onSend: (message: string, attachments: Attachment[], noteMentions: NoteMentionReference[]) => void;
  onStop: () => void;
  isLoading: boolean;
  selectedModel: AIModel | undefined;
  focusTrigger?: number;
  sessionId?: string | null;
  sentUserMessages: string[];
  isEmbedded?: boolean;
}

export const ChatInput = memo(function ChatInput({
  onSend,
  onStop,
  isLoading,
  selectedModel,
  focusTrigger,
  sessionId,
  sentUserMessages,
  isEmbedded = false,
}: ChatInputProps) {
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
    onSend,
    attachments,
    getNoteMentions: () => noteMentions,
    onAfterSend: () => {
      clearAttachments();
      clearNoteMentions();
    },
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

  const focusComposerToEnd = useCallback(() => {
    const input = textareaRef.current;
    if (!input) {
      return;
    }
    input.focus({ preventScroll: true });
    const pos = input.value.length;
    input.setSelectionRange(pos, pos);
  }, [textareaRef]);

  const {
    noteMentions,
    clearNoteMentions,
    currentPageCandidates,
    linkedPageCandidates,
    mentionPreviewParts,
    showMentionPicker,
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
      requestAnimationFrame(() => {
        const input = textareaRef.current;
        if (!input) {
          return;
        }
        input.focus({ preventScroll: true });
        input.setSelectionRange(nextCaret, nextCaret);
      });
    },
    [handleCaretChange, handleMessageChange, markExplicitMultiline, textareaRef]
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
    if (message.length === 0) {
      resetHistoryNavigation();
    }
  }, [message, resetHistoryNavigation]);

  const handleHiddenFileInputChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      await handleFileChange(e);
      requestAnimationFrame(() => {
        focusComposerToEnd();
      });
    },
    [focusComposerToEnd, handleFileChange]
  );

  const handleTriggerFileSelect = useCallback(() => {
    triggerFileSelect();
    if (typeof window === 'undefined') {
      return;
    }
    const restoreFocus = () => {
      requestAnimationFrame(() => {
        focusComposerToEnd();
      });
    };
    window.addEventListener('focus', restoreFocus, { capture: true, once: true });
  }, [focusComposerToEnd, triggerFileSelect]);

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
    !!selectedModel;
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
        {isDragging && (
          <div className="absolute inset-0 z-20 flex items-center justify-center rounded-[32px] border-2 border-dashed border-[var(--chat-sidebar-icon)]/50 bg-black/[0.03] backdrop-blur-sm pointer-events-none dark:border-white/15 dark:bg-white/[0.04]">
            <span className="font-medium text-[var(--chat-sidebar-text-muted)] dark:text-[var(--chat-sidebar-text-soft)]">
              Drop files here
            </span>
          </div>
        )}

        <div className="flex flex-col px-1 w-full">
          {showMentionPicker && (
            <NoteMentionPicker
              currentPageCandidates={currentPageCandidates}
              linkedPageCandidates={linkedPageCandidates}
              activeCandidatePath={activeCandidatePath}
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
            placeholder={!selectedModel ? 'Select a model...' : isLoading ? 'Type to interrupt...' : 'Message...'}
            mentionPreviewParts={mentionPreviewParts}
            textareaScrollTop={textareaScrollTop}
            onRemoveMention={removeNoteMention}
          />

          <ChatInputActions
            onTriggerFileSelect={handleTriggerFileSelect}
            isLoading={isLoading}
            canSend={canSend}
            hasDraftMessage={!!message.trim()}
            onStop={onStop}
            onSend={() => handleSend()}
            composerInputRef={textareaRef}
            isEmbedded={isEmbedded}
          />
        </div>
      </div>
    </>
  );
});
