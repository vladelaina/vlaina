import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';
import type { AIModel } from '@/lib/ai/types';
import type { Attachment } from '@/lib/storage/attachmentStorage';
import type { NoteMentionReference } from '@/lib/ai/noteMentions';
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
import { useNotesStore } from '@/stores/notes/useNotesStore';
import { Icon } from '@/components/ui/icons';
import {
  buildMentionPreviewParts,
  collectNotePaths,
  getNoteMentionTrigger,
  insertMentionAtTrigger,
  type MentionPreviewPart,
  type NoteMentionCandidate,
} from './noteMentionHelpers';

interface ChatInputProps {
  onSend: (message: string, attachments: Attachment[], noteMentions: NoteMentionReference[]) => void;
  onStop: () => void;
  isLoading: boolean;
  selectedModel: AIModel | undefined;
  focusTrigger?: number;
  sessionId?: string | null;
  sentUserMessages: string[];
}

export const ChatInput = memo(function ChatInput({
  onSend,
  onStop,
  isLoading,
  selectedModel,
  focusTrigger,
  sessionId,
  sentUserMessages,
}: ChatInputProps) {
  const notesRootFolder = useNotesStore((state) => state.rootFolder);
  const currentNotePath = useNotesStore((state) => state.currentNote?.path ?? null);
  const notesPath = useNotesStore((state) => state.notesPath);
  const notesLoading = useNotesStore((state) => state.isLoading);
  const loadFileTree = useNotesStore((state) => state.loadFileTree);
  const getDisplayName = useNotesStore((state) => state.getDisplayName);

  const [noteMentions, setNoteMentions] = useState<NoteMentionReference[]>([]);
  const [caretIndex, setCaretIndex] = useState(0);
  const [activeMentionIndex, setActiveMentionIndex] = useState(0);
  const [textareaScrollTop, setTextareaScrollTop] = useState(0);
  const [historyBrowseIndex, setHistoryBrowseIndex] = useState<number | null>(null);
  const [historyDraftMessage, setHistoryDraftMessage] = useState('');

  const allNoteCandidates = useMemo<NoteMentionCandidate[]>(() => {
    if (!notesRootFolder) {
      return [];
    }

    const paths: string[] = [];
    collectNotePaths(notesRootFolder.children, paths);
    const uniquePaths = Array.from(new Set(paths));

    return uniquePaths
      .map((path) => ({
        path,
        title: getDisplayName(path),
        isCurrent: path === currentNotePath,
      }))
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [currentNotePath, getDisplayName, notesRootFolder]);

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
    noteMentions,
    onAfterSend: () => {
      clearAttachments();
      setNoteMentions([]);
      setHistoryBrowseIndex(null);
      setHistoryDraftMessage('');
    },
    focusTrigger,
  });

  const mentionTrigger = useMemo(
    () => getNoteMentionTrigger(message, caretIndex),
    [message, caretIndex]
  );

  const filteredCandidates = useMemo(() => {
    if (!mentionTrigger) {
      return [];
    }

    const query = mentionTrigger.query.trim().toLowerCase();
    const candidates = allNoteCandidates.filter((candidate) => {
      if (!query) {
        return true;
      }
      return (
        candidate.title.toLowerCase().includes(query) ||
        candidate.path.toLowerCase().includes(query)
      );
    });

    return candidates
      .sort((a, b) => {
        if (a.isCurrent !== b.isCurrent) {
          return a.isCurrent ? -1 : 1;
        }
        return a.title.localeCompare(b.title);
      })
      .slice(0, 30);
  }, [allNoteCandidates, mentionTrigger]);

  const showMentionPicker = !!mentionTrigger && filteredCandidates.length > 0;

  const currentPageCandidates = useMemo(
    () => filteredCandidates.filter((candidate) => candidate.isCurrent),
    [filteredCandidates]
  );
  const linkedPageCandidates = useMemo(
    () => filteredCandidates.filter((candidate) => !candidate.isCurrent),
    [filteredCandidates]
  );

  useEffect(() => {
    setActiveMentionIndex(0);
  }, [mentionTrigger?.query, mentionTrigger?.start]);

  useEffect(() => {
    setHistoryBrowseIndex(null);
    setHistoryDraftMessage('');
  }, [sessionId]);

  useEffect(() => {
    if (!mentionTrigger || mentionTrigger.start < 0) {
      return;
    }
    if (notesRootFolder || !notesPath || notesLoading) {
      return;
    }
    void loadFileTree();
  }, [loadFileTree, mentionTrigger, notesLoading, notesPath, notesRootFolder]);

  useEffect(() => {
    setNoteMentions((prev) =>
      prev.filter((mention) => message.includes(`@${mention.title}`))
    );
  }, [message]);

  const addNoteMention = useCallback((nextMention: NoteMentionReference) => {
    setNoteMentions((prev) => {
      if (prev.some((mention) => mention.path === nextMention.path)) {
        return prev;
      }
      return [...prev, nextMention];
    });
  }, []);

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

  const applyHistoryMessage = useCallback(
    (nextMessage: string) => {
      if (nextMessage.includes('\n')) {
        markExplicitMultiline();
      }
      handleMessageChange(nextMessage);
      const nextCaret = nextMessage.length;
      setCaretIndex(nextCaret);
      requestAnimationFrame(() => {
        const input = textareaRef.current;
        if (!input) {
          return;
        }
        input.focus({ preventScroll: true });
        input.setSelectionRange(nextCaret, nextCaret);
      });
    },
    [handleMessageChange, markExplicitMultiline, textareaRef]
  );

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

  const removeNoteMention = useCallback(
    (path: string, rangeStart?: number) => {
      const target = noteMentions.find((mention) => mention.path === path);
      if (target) {
        const label = `@${target.title}`;
        const index = typeof rangeStart === 'number' ? rangeStart : message.indexOf(label);
        const nextMessage =
          index >= 0
            ? `${message.slice(0, index)}${message.slice(index + label.length)}`
            : message;
        handleMessageChange(nextMessage);
        setCaretIndex(index >= 0 ? index : (prev) => Math.min(prev, nextMessage.length));
      }

      setNoteMentions((prev) => prev.filter((mention) => mention.path !== path));
    },
    [handleMessageChange, message, noteMentions]
  );

  const applyMentionCandidate = useCallback(
    (candidate: NoteMentionCandidate) => {
      if (!mentionTrigger) {
        return;
      }

      const { nextValue: nextMessage, nextCaret } = insertMentionAtTrigger(
        message,
        mentionTrigger,
        candidate.title
      );

      addNoteMention({ path: candidate.path, title: candidate.title });
      handleMessageChange(nextMessage);
      setCaretIndex(-1);

      requestAnimationFrame(() => {
        const input = textareaRef.current;
        if (!input) {
          return;
        }
        input.focus({ preventScroll: true });
        input.setSelectionRange(nextCaret, nextCaret);
      });
    },
    [addNoteMention, handleMessageChange, mentionTrigger, message, textareaRef]
  );

  const mentionPreviewParts = useMemo(
    () => buildMentionPreviewParts(message, noteMentions),
    [message, noteMentions]
  );

  const handleTextareaKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const selectionStart = e.currentTarget.selectionStart ?? 0;
      const selectionEnd = e.currentTarget.selectionEnd ?? 0;
      const mentionRanges = mentionPreviewParts.filter(
        (part): part is MentionPreviewPart & { mention: NoteMentionReference } =>
          part.type === 'mention' && !!part.mention
      );

      if (e.key === 'Backspace' || e.key === 'Delete') {
        if (selectionStart !== selectionEnd) {
          const overlapped = mentionRanges.filter(
            (part) => selectionStart < part.end && selectionEnd > part.start
          );
          if (overlapped.length > 0) {
            e.preventDefault();
            const part = overlapped[0];
            removeNoteMention(part.mention.path, part.start);
            return;
          }
        }

        const targetPart = mentionRanges.find((part) =>
          e.key === 'Backspace'
            ? selectionStart > part.start && selectionStart <= part.end
            : selectionStart >= part.start && selectionStart < part.end
        );
        if (targetPart) {
          e.preventDefault();
          removeNoteMention(targetPart.mention.path, targetPart.start);
          return;
        }
      }

      if (
        e.key === 'Backspace' &&
        noteMentions.length > 0 &&
        selectionStart === 0 &&
        selectionEnd === 0
      ) {
        e.preventDefault();
        const lastMention = noteMentions[noteMentions.length - 1];
        if (lastMention) {
          removeNoteMention(lastMention.path);
        }
        return;
      }

      if (showMentionPicker) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setActiveMentionIndex((prev) => (prev + 1) % filteredCandidates.length);
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setActiveMentionIndex((prev) =>
            prev - 1 < 0 ? filteredCandidates.length - 1 : prev - 1
          );
          return;
        }
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          const candidate = filteredCandidates[activeMentionIndex] ?? filteredCandidates[0];
          if (candidate) {
            applyMentionCandidate(candidate);
            return;
          }
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          setCaretIndex(-1);
          return;
        }
      }

      const hasHistoryItems = sentUserMessages.length > 0;
      const hasModifier = e.shiftKey || e.altKey || e.ctrlKey || e.metaKey;
      const isCollapsedSelection = selectionStart === selectionEnd;

      if (!showMentionPicker && hasHistoryItems && !hasModifier && isCollapsedSelection) {
        if (e.key === 'ArrowUp' && (selectionStart === 0 || historyBrowseIndex !== null)) {
          e.preventDefault();
          const latestIndex = sentUserMessages.length - 1;
          const nextIndex = historyBrowseIndex === null
            ? latestIndex
            : Math.max(0, Math.min(historyBrowseIndex - 1, latestIndex));
          if (historyBrowseIndex === null) {
            setHistoryDraftMessage(message);
          }
          setHistoryBrowseIndex(nextIndex);
          applyHistoryMessage(sentUserMessages[nextIndex] ?? '');
          return;
        }

        if (e.key === 'ArrowDown' && historyBrowseIndex !== null) {
          e.preventDefault();
          const latestIndex = sentUserMessages.length - 1;
          if (historyBrowseIndex < latestIndex) {
            const nextIndex = historyBrowseIndex + 1;
            setHistoryBrowseIndex(nextIndex);
            applyHistoryMessage(sentUserMessages[nextIndex] ?? '');
            return;
          }
          setHistoryBrowseIndex(null);
          applyHistoryMessage(historyDraftMessage);
          setHistoryDraftMessage('');
          return;
        }
      }

      handleKeyDown(e);
    },
    [
      applyHistoryMessage,
      activeMentionIndex,
      applyMentionCandidate,
      filteredCandidates,
      handleKeyDown,
      historyBrowseIndex,
      historyDraftMessage,
      message,
      mentionPreviewParts,
      noteMentions,
      removeNoteMention,
      sentUserMessages,
      showMentionPicker,
    ]
  );

  const canSend = (!!message.trim() || attachments.length > 0 || noteMentions.length > 0) && !!selectedModel;

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
            <div
              className="absolute left-3 right-3 bottom-full mb-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1d1d1d] shadow-xl p-2 max-h-72 overflow-y-auto z-40"
              data-no-focus-input="true"
            >
              {currentPageCandidates.length > 0 && (
                <div className="mb-2">
                  <p className="px-2 pb-1 text-[11px] font-medium text-gray-500">Current page</p>
                  <div className="space-y-0.5">
                    {currentPageCandidates.map((candidate) => {
                      const candidateIndex = filteredCandidates.findIndex((item) => item.path === candidate.path);
                      const isActive = candidateIndex === activeMentionIndex;
                      return (
                        <button
                          key={`current-${candidate.path}`}
                          type="button"
                          className={cn(
                            "w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm",
                            isActive
                              ? "bg-gray-100 dark:bg-zinc-700 text-gray-900 dark:text-gray-100"
                              : "hover:bg-gray-50 dark:hover:bg-zinc-800 text-gray-700 dark:text-gray-200"
                          )}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => applyMentionCandidate(candidate)}
                        >
                          <Icon name="file.text" size="sm" className="text-gray-400" />
                          <span className="truncate">{candidate.title}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {linkedPageCandidates.length > 0 && (
                <div>
                  <p className="px-2 pb-1 text-[11px] font-medium text-gray-500">Link to page</p>
                  <div className="space-y-0.5">
                    {linkedPageCandidates.map((candidate) => {
                      const candidateIndex = filteredCandidates.findIndex((item) => item.path === candidate.path);
                      const isActive = candidateIndex === activeMentionIndex;
                      return (
                        <button
                          key={candidate.path}
                          type="button"
                          className={cn(
                            "w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm",
                            isActive
                              ? "bg-gray-100 dark:bg-zinc-700 text-gray-900 dark:text-gray-100"
                              : "hover:bg-gray-50 dark:hover:bg-zinc-800 text-gray-700 dark:text-gray-200"
                          )}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => applyMentionCandidate(candidate)}
                        >
                          <Icon name="file.text" size="sm" className="text-gray-400" />
                          <span className="truncate">{candidate.title}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          <ChatAttachmentPreviewList attachments={attachments} onRemove={removeAttachment} />

          <div className={chatComposerInputBlockClass}>
            <div className="relative">
              <textarea
                ref={textareaRef}
                value={message}
                onChange={(e) => {
                  handleMessageChange(e.target.value);
                  if (historyBrowseIndex !== null || historyDraftMessage) {
                    setHistoryBrowseIndex(null);
                    setHistoryDraftMessage('');
                  }
                  setCaretIndex(e.target.selectionStart ?? e.target.value.length);
                }}
                onCompositionStart={handleCompositionStart}
                onCompositionEnd={handleCompositionEnd}
                onKeyDown={handleTextareaKeyDown}
                onSelect={(e) => setCaretIndex(e.currentTarget.selectionStart ?? 0)}
                onClick={(e) => setCaretIndex(e.currentTarget.selectionStart ?? 0)}
                onBlur={() => setCaretIndex(-1)}
                onPaste={handleTextareaPaste}
                onScroll={(e) => setTextareaScrollTop(e.currentTarget.scrollTop)}
                placeholder={!selectedModel ? 'Select a model...' : isLoading ? 'Type to interrupt...' : 'Message...'}
                rows={1}
                className={cn(chatComposerTextareaClass, "relative z-10 w-full")}
              />
              {mentionPreviewParts.length > 0 && (
                <div
                  className="pointer-events-none absolute inset-0 z-20 whitespace-pre-wrap break-words text-[15px] leading-6"
                  style={{ transform: `translateY(${-textareaScrollTop}px)` }}
                  aria-hidden="true"
                >
                  {mentionPreviewParts.map((part) =>
                    part.type === 'mention' && part.mention ? (
                      <span
                        key={part.key}
                        className="pointer-events-auto group relative inline rounded-md bg-blue-500/90 text-white dark:bg-blue-500/80"
                        data-no-focus-input="true"
                      >
                        {part.text}
                        <button
                          type="button"
                          className="absolute -right-1 -top-1 z-10 rounded-full bg-blue-500/95 px-1 text-[10px] leading-4 text-white opacity-0 transition-opacity group-hover:opacity-100"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => removeNoteMention(part.mention!.path)}
                        >
                          ×
                        </button>
                      </span>
                    ) : (
                      <span key={part.key} className="text-transparent">
                        {part.text}
                      </span>
                    )
                  )}
                </div>
              )}
            </div>
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
