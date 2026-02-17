import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { Icon } from '@/components/ui/icons';
import { LocalImage } from '@/components/Chat/common/LocalImage';
import { cn } from '@/lib/utils';
import {
  chatComposerFrameClass,
  chatComposerInputBlockClass,
  chatComposerPrimaryButtonClass,
  chatComposerSecondaryButtonClass,
  chatComposerSurfaceClass,
  chatComposerTextareaClass
} from '../../Input/composerStyles';
import type { ChatMessage } from '@/lib/ai/types';

interface UserMessageProps {
  message: ChatMessage;
  onEdit?: (id: string, newContent: string) => void;
  onSwitchVersion?: (id: string, targetIndex: number) => void;
}

export function UserMessage({ message, onEdit, onSwitchVersion }: UserMessageProps) {
  const content = message.content || '';
  const [isEditing, setIsEditing] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [editValue, setEditValue] = useState(content);
  const [isComposing, setIsComposing] = useState(false);
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);

  const versions = message.versions || [];
  const currentIdx = message.currentVersionIndex ?? 0;
  const hasMultipleVersions = versions.length > 1;

  // Parse images for display mode
  const imgRegex = /!\[.*?\]\((.*?)\)/g;
  const images: string[] = [];
  let displayText = content;
  let match;
  while ((match = imgRegex.exec(content)) !== null) {
      images.push(match[1]);
  }
  displayText = displayText.replace(imgRegex, '').trim();

  // Reset edit value when content prop changes (if not currently editing)
  useEffect(() => {
      if (!isEditing) setEditValue(content);
  }, [content, isEditing]);

  // Ensure caret lands at the end after entering edit mode.
  useEffect(() => {
      if (!isEditing || !editTextareaRef.current) return;
      const el = editTextareaRef.current;
      requestAnimationFrame(() => {
          el.focus();
          const pos = el.value.length;
          el.setSelectionRange(pos, pos);
          el.scrollTop = el.scrollHeight;
      });
  }, [isEditing]);

  // Match main composer behavior: grow textarea from content scrollHeight.
  useEffect(() => {
      if (!isEditing || !editTextareaRef.current) return;
      const el = editTextareaRef.current;
      el.style.height = "auto";
      el.style.height = `${Math.min(el.scrollHeight, 320)}px`;
  }, [isEditing, editValue]);

  const handleSave = () => {
      const normalized = editValue.replace(/\r\n?/g, '\n');
      const normalizedCurrent = content.replace(/\r\n?/g, '\n');
      if (normalized.trim() !== normalizedCurrent.trim()) {
          onEdit?.(message.id, normalized);
      }
      setIsEditing(false);
  };

  const handleCancel = () => {
      setEditValue(content);
      setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
      const native = e.nativeEvent as KeyboardEvent & { isComposing?: boolean; keyCode?: number };
      if (e.key === 'Enter' && !e.shiftKey) {
          if (isComposing || native.isComposing || native.keyCode === 229) {
              e.preventDefault();
              return;
          }
          e.preventDefault();
          e.stopPropagation();
          handleSave();
          return;
      }
      if (e.key === 'Escape') {
          e.preventDefault();
          handleCancel();
      }
  };

  const handleCopy = () => {
      navigator.clipboard.writeText(content);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="group w-full flex flex-col items-end gap-1 max-w-full">
      {isEditing ? (
        <motion.div
          initial={{ clipPath: "inset(0 0 0 100%)", opacity: 0.85 }}
          animate={{ clipPath: "inset(0 0 0 0%)", opacity: 1 }}
          transition={{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }}
          className="w-full flex justify-end"
          style={{ willChange: "clip-path, opacity" }}
        >
          <div className={cn("w-full", chatComposerFrameClass, chatComposerSurfaceClass)}>
            <div className={chatComposerInputBlockClass}>
              <textarea
                ref={editTextareaRef}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onCompositionStart={() => setIsComposing(true)}
                onCompositionEnd={() => setIsComposing(false)}
                onKeyDown={handleKeyDown}
                className={cn("p-0 m-0 border-0", chatComposerTextareaClass)}
                rows={1}
              />
            </div>

            <div className="flex justify-end items-center gap-2 px-2 pb-2 pr-3">
              <button
                onClick={handleCancel}
                className={cn(chatComposerSecondaryButtonClass, "h-8 px-3.5 text-[13px]")}
              >
                取消
              </button>
              <button
                onClick={handleSave}
                className={cn(chatComposerPrimaryButtonClass, "h-8 px-3.5 text-[13px] font-semibold")}
              >
                发送
              </button>
            </div>
          </div>
        </motion.div>
      ) : (
        <div className="w-full flex flex-col items-end">
          <div className="w-full flex flex-col items-end gap-2">
            {images.map((src, i) => (
              <div
                key={i}
                data-no-focus-input="true"
                className="rounded-xl overflow-hidden border border-black/5 dark:border-white/10 shadow-sm bg-white dark:bg-zinc-800"
              >
                <LocalImage
                  src={src}
                  alt="attachment"
                  className="max-w-xs max-h-64 object-contain cursor-pointer hover:opacity-90 transition-opacity"
                  onClick={() => window.open(src, '_blank')}
                />
              </div>
            ))}
            {displayText && (
              <div
                data-no-focus-input="true"
                className="inline-block max-w-[85%] bg-[#F4F4F5] dark:bg-[#2C2C2C] px-4 py-2 rounded-[20px] text-gray-900 dark:text-gray-100 text-[15px] leading-6 shadow-sm border border-black/5 dark:border-white/5 text-left overflow-hidden"
              >
                <div className="whitespace-pre-wrap break-words">{displayText}</div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150 mr-1 mt-1">
            {hasMultipleVersions && onSwitchVersion && (
              <div className="flex items-center gap-1 bg-gray-100 dark:bg-white/5 rounded-md p-0.5 select-none">
                <button
                  onClick={() => {
                    currentIdx > 0 && onSwitchVersion(message.id, currentIdx - 1);
                  }}
                  disabled={currentIdx === 0}
                  className="p-0.5 text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 disabled:opacity-30 disabled:cursor-default transition-colors"
                >
                  <Icon name="nav.chevronLeft" size="md" />
                </button>
                <span className="text-[10px] font-mono font-medium text-gray-600 dark:text-gray-400 min-w-[24px] text-center">
                  {currentIdx + 1} / {versions.length}
                </span>
                <button
                  onClick={() => {
                    currentIdx < versions.length - 1 && onSwitchVersion(message.id, currentIdx + 1);
                  }}
                  disabled={currentIdx === versions.length - 1}
                  className="p-0.5 text-gray-500 hover:text-gray-900 dark:hover:text-gray-100 disabled:opacity-30 disabled:cursor-default transition-colors"
                >
                  <Icon name="nav.chevronRight" size="md" />
                </button>
              </div>
            )}

            <div className="flex items-center gap-1">
              <button
                onClick={handleCopy}
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5 rounded-md transition-colors"
              >
                {isCopied ? <Icon name="common.check" size="md" /> : <Icon name="common.copy" size="md" />}
              </button>

              <button
                onClick={() => {
                  if (onEdit) {
                    setEditValue(content);
                    setIsEditing(true);
                  }
                }}
                className={cn(
                  "p-1.5 rounded-md transition-colors",
                  onEdit
                    ? "text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/10"
                    : "text-gray-300 cursor-not-allowed"
                )}
              >
                <Icon name="common.compose" size="md" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
