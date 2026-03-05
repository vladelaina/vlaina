import { memo, useCallback } from 'react';
import { cn } from '@/lib/utils';
import type { AIModel } from '@/lib/ai/types';
import type { Attachment } from '@/lib/storage/attachmentStorage';
import {
  chatComposerFrameClass,
  chatComposerInputBlockClass,
  chatComposerSurfaceClass,
  chatComposerTextareaClass,
} from './composerStyles';
import { useChatComposer } from './hooks/useChatComposer';
import { useChatAttachments } from './hooks/useChatAttachments';
import { ChatAttachmentPreviewList } from './components/ChatAttachmentPreviewList';
import { ChatInputActions } from './components/ChatInputActions';

interface ChatInputProps {
  onSend: (message: string, attachments: Attachment[]) => void;
  onStop: () => void;
  isLoading: boolean;
  selectedModel: AIModel | undefined;
  focusTrigger?: number;
}

export const ChatInput = memo(function ChatInput({
  onSend,
  onStop,
  isLoading,
  selectedModel,
  focusTrigger,
}: ChatInputProps) {
  const {
    attachments,
    isDragging,
    fileInputRef,
    handlePaste,
    handleDrop,
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
    onAfterSend: clearAttachments,
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

  const canSend = (!!message.trim() || attachments.length > 0) && !!selectedModel;

  return (
    <>
      <input
        type="file"
        multiple
        className="hidden"
        ref={fileInputRef}
        onChange={handleHiddenFileInputChange}
      />

      {isDragging && (
        <div className="absolute inset-0 z-20 bg-blue-500/10 border-2 border-dashed border-blue-500 rounded-[32px] flex items-center justify-center backdrop-blur-sm pointer-events-none">
          <span className="text-blue-600 font-medium">Drop files here</span>
        </div>
      )}

      <div
        data-chat-input="true"
        ref={composerRootRef}
        className={cn(
          'relative z-10',
          chatComposerFrameClass,
          chatComposerSurfaceClass
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="flex flex-col px-1 w-full">
          <ChatAttachmentPreviewList attachments={attachments} onRemove={removeAttachment} />

          <div className={chatComposerInputBlockClass}>
            <textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => handleMessageChange(e.target.value)}
              onCompositionStart={handleCompositionStart}
              onCompositionEnd={handleCompositionEnd}
              onKeyDown={handleKeyDown}
              onPaste={handleTextareaPaste}
              placeholder={!selectedModel ? 'Select a model...' : isLoading ? 'Type to interrupt...' : 'Message...'}
              rows={1}
              className={chatComposerTextareaClass}
            />
          </div>

          <ChatInputActions
            onTriggerFileSelect={handleTriggerFileSelect}
            isLoading={isLoading}
            canSend={canSend}
            hasDraftMessage={!!message.trim()}
            onStop={onStop}
            onSend={() => handleSend()}
            composerInputRef={textareaRef}
          />
        </div>
      </div>
    </>
  );
});
