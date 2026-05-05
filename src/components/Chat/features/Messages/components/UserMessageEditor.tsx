import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { Attachment } from '@/lib/storage/attachmentStorage';
import {
  chatComposerFrameClass,
  chatComposerSecondaryButtonClass,
  chatComposerSurfaceClass,
} from '../../Input/composerStyles';
import { ChatAttachmentPreviewList } from '../../Input/components/ChatAttachmentPreviewList';
import { ChatComposerField } from '../../Input/components/ChatComposerField';
import type { ChatMessage } from '@/lib/ai/types';
import { NoteMentionPicker } from '@/components/Chat/features/Input/components/NoteMentionPicker';
import { usePredictedTextareaHeight } from '@/hooks/usePredictedTextareaHeight';
import {
  composeUserMessageContent,
  type ParsedUserMessageContent,
  toEditAttachment,
} from './userMessageContent';
import { useUserMessageEditorMentions } from './useUserMessageEditorMentions';

const editComposerSurfaceClass = cn(
  chatComposerSurfaceClass,
  'shadow-none hover:shadow-none'
);

interface UserMessageEditorProps {
  message: ChatMessage;
  parsedContent: ParsedUserMessageContent;
  onClose: () => void;
  onEdit?: (id: string, newContent: string) => void;
}

export function UserMessageEditor({
  message,
  parsedContent,
  onClose,
  onEdit,
}: UserMessageEditorProps) {
  const content = message.content || '';
  const [editValue, setEditValue] = useState(parsedContent.text);
  const [editAttachments, setEditAttachments] = useState<Attachment[]>(() =>
    parsedContent.imageSources.map((src, index) => toEditAttachment(src, index))
  );
  const [isComposing, setIsComposing] = useState(false);
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);
  const handleEditValueChange = useCallback((nextValue: string) => {
    setEditValue(nextValue);
  }, []);

  const {
    currentPageCandidates,
    linkedPageCandidates,
    mentionPreviewParts,
    showMentionPicker,
    mentionPickerStatus,
    activeCandidatePath,
    textareaScrollTop,
    handleValueChange,
    handleCaretBlur,
    handleMentionKeyDown,
    setTextareaScrollTop,
    setCaretIndex,
    applyMentionCandidate,
    removeMention,
  } = useUserMessageEditorMentions({
    value: editValue,
    onValueChange: handleEditValueChange,
    textareaRef: editTextareaRef,
  });

  useEffect(() => {
    const input = editTextareaRef.current;
    if (!input) {
      return;
    }

    requestAnimationFrame(() => {
      input.focus();
      const position = input.value.length;
      input.setSelectionRange(position, position);
      input.scrollTop = input.scrollHeight;
    });
  }, []);

  usePredictedTextareaHeight(editTextareaRef, {
    value: editValue,
    minHeight: 24,
    maxHeight: 320,
  });

  const handleSave = useCallback(() => {
    const normalized = composeUserMessageContent(editValue, editAttachments);
    const normalizedCurrent = content.replace(/\r\n?/g, '\n');
    if (normalized.trim() !== normalizedCurrent.trim()) {
      onEdit?.(message.id, normalized);
    }
    onClose();
  }, [content, editAttachments, editValue, message.id, onClose, onEdit]);

  const handleCancel = useCallback(() => {
    onClose();
  }, [onClose]);

  const handleRemoveEditAttachment = useCallback((id: string) => {
    setEditAttachments((prev) => prev.filter((attachment) => attachment.id !== id));
  }, []);

  const handleTextareaPaste = useCallback(() => {}, []);

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const native = event.nativeEvent as KeyboardEvent & { isComposing?: boolean; keyCode?: number };
    if (handleMentionKeyDown(event)) {
      return;
    }

    if (event.key === 'Enter' && !event.shiftKey) {
      if (isComposing || native.isComposing || native.keyCode === 229) {
        event.preventDefault();
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      handleSave();
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      handleCancel();
    }
  }, [
    handleCancel,
    handleMentionKeyDown,
    handleSave,
    isComposing,
  ]);

  return (
    <motion.div
      initial={{ clipPath: 'inset(0 0 0 100%)', opacity: 0.85 }}
      animate={{ clipPath: 'inset(0 0 0 0%)', opacity: 1 }}
      transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
      className="w-full flex justify-end"
      style={{ willChange: 'clip-path, opacity' }}
    >
      <div className={cn('w-full', chatComposerFrameClass, editComposerSurfaceClass)}>
        <ChatAttachmentPreviewList attachments={editAttachments} onRemove={handleRemoveEditAttachment} />
        {showMentionPicker && (
          <NoteMentionPicker
            currentPageCandidates={currentPageCandidates}
            activeCandidatePath={activeCandidatePath}
            linkedPageCandidates={linkedPageCandidates}
            status={mentionPickerStatus}
            className="left-0 right-0"
            onSelect={applyMentionCandidate}
          />
        )}
        <ChatComposerField
          textareaRef={editTextareaRef}
          message={editValue}
          placeholder=""
          textareaScrollTop={textareaScrollTop}
          mentionPreviewParts={mentionPreviewParts}
          onChange={(event) => {
            handleValueChange(event.target.value, event.target.selectionStart ?? event.target.value.length);
          }}
          onCompositionStart={() => setIsComposing(true)}
          onCompositionEnd={() => setIsComposing(false)}
          onKeyDown={handleKeyDown}
          onSelect={(event) => setCaretIndex(event.currentTarget.selectionStart ?? 0)}
          onClick={(event) => setCaretIndex(event.currentTarget.selectionStart ?? 0)}
          onBlur={handleCaretBlur}
          onPaste={handleTextareaPaste}
          onScroll={(event) => setTextareaScrollTop(event.currentTarget.scrollTop)}
          onRemoveMention={removeMention}
        />

        <div className="flex justify-end items-center gap-2 px-2 pb-2 pr-3">
          <button
            onClick={handleCancel}
            className={cn(
              chatComposerSecondaryButtonClass,
              'h-8 px-3.5 text-[13px] bg-white hover:bg-white dark:bg-white dark:text-zinc-900 dark:hover:bg-white'
            )}
          >
            取消
          </button>
          <button
            onClick={handleSave}
            className="h-8 rounded-full bg-[#41a8ea] px-3.5 text-[13px] font-semibold text-white shadow-md shadow-[#41a8ea]/25 transition-all duration-200 hover:scale-105 active:scale-95"
            style={{ boxShadow: '0 0 0 3px rgba(65, 168, 234, 0.12), 0 10px 24px rgba(65, 168, 234, 0.28)' }}
          >
            发送
          </button>
        </div>
      </div>
    </motion.div>
  );
}
