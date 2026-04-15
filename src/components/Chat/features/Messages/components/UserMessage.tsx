import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Icon } from '@/components/ui/icons';
import { LocalImage } from '@/components/Chat/common/LocalImage';
import { cn } from '@/lib/utils';
import type { Attachment } from '@/lib/storage/attachmentStorage';
import {
  chatComposerFrameClass,
  chatComposerInputBlockClass,
  chatComposerPrimaryButtonClass,
  chatComposerSecondaryButtonClass,
  chatComposerSurfaceClass,
  chatComposerTextareaClass
} from '../../Input/composerStyles';
import { ChatAttachmentPreviewList } from '../../Input/components/ChatAttachmentPreviewList';
import type { ChatMessage } from '@/lib/ai/types';
import { normalizeExternalHref, openExternalHref } from '@/lib/navigation/externalLinks';
import {
  copyMessageContentToClipboard,
  extractMarkdownImageSources,
  stripMarkdownImageTokens,
} from '@/components/Chat/common/messageClipboard';
import { useNotesStore } from '@/stores/notes/useNotesStore';
import type { NoteMentionReference } from '@/lib/ai/noteMentions';
import {
  buildMentionPreviewParts,
  collectNotePaths,
  getNoteMentionTrigger,
  insertMentionAtTrigger,
  type MentionPreviewPart,
  type NoteMentionCandidate,
} from '@/components/Chat/features/Input/noteMentionHelpers';
import { usePredictedTextareaHeight } from '@/hooks/usePredictedTextareaHeight';

interface ParsedUserMessageContent {
  text: string;
  imageSources: string[];
}

function isSvgSource(src: string): boolean {
  const normalized = src.trim().toLowerCase();
  if (normalized.startsWith('data:image/svg+xml')) {
    return true;
  }
  const pathname = normalized.split('?')[0] ?? '';
  return pathname.endsWith('.svg');
}

function inferImageMimeType(src: string): string {
  if (src.startsWith('data:image/')) {
    const match = /^data:(image\/[^;,]+)/.exec(src);
    return match?.[1] ?? 'image/*';
  }

  const pathname = src.split('?')[0]?.toLowerCase() ?? '';
  if (pathname.endsWith('.png')) return 'image/png';
  if (pathname.endsWith('.jpg') || pathname.endsWith('.jpeg')) return 'image/jpeg';
  if (pathname.endsWith('.webp')) return 'image/webp';
  if (pathname.endsWith('.gif')) return 'image/gif';
  if (pathname.endsWith('.avif')) return 'image/avif';
  if (pathname.endsWith('.bmp')) return 'image/bmp';
  if (pathname.endsWith('.svg')) return 'image/svg+xml';
  return 'image/*';
}

function inferAttachmentName(src: string, index: number): string {
  if (src.startsWith('data:image/')) {
    const mime = inferImageMimeType(src);
    const ext = mime.split('/')[1]?.replace('svg+xml', 'svg') || 'png';
    return `image-${index + 1}.${ext}`;
  }

  const base = src.split('?')[0]?.split('/').pop()?.trim();
  return base || `image-${index + 1}.png`;
}

function toEditAttachment(src: string, index: number): Attachment {
  return {
    id: `edit-attachment-${index}`,
    path: '',
    previewUrl: src,
    assetUrl: src,
    name: inferAttachmentName(src, index),
    type: inferImageMimeType(src),
    size: 0,
  };
}

function parseUserMessageContent(content: string): ParsedUserMessageContent {
  return {
    imageSources: extractMarkdownImageSources(content),
    text: stripMarkdownImageTokens(content).trim(),
  };
}

function composeUserMessageContent(text: string, attachments: Attachment[]): string {
  const normalizedText = text.replace(/\r\n?/g, '\n');
  const imageMarkdown = attachments
    .map((attachment) => attachment.assetUrl?.trim())
    .filter((src): src is string => !!src)
    .map((src) => `![image](<${src}>)`)
    .join('\n');
  const hasText = normalizedText.trim().length > 0;

  if (imageMarkdown && hasText) {
    return `${imageMarkdown}\n\n${normalizedText}`;
  }
  if (imageMarkdown) {
    return imageMarkdown;
  }
  return normalizedText;
}

const editComposerSurfaceClass = cn(
  chatComposerSurfaceClass,
  "shadow-none hover:shadow-none"
);

interface UserMessageProps {
  message: ChatMessage;
  onEdit?: (id: string, newContent: string) => void;
  onSwitchVersion?: (id: string, targetIndex: number) => void;
}

export function UserMessage({ message, onEdit, onSwitchVersion }: UserMessageProps) {
  const content = message.content || '';
  const parsedContent = useMemo(() => {
    const parsed = parseUserMessageContent(content);
    if (message.role === 'user' && message.imageSources && message.imageSources.length > 0) {
      return {
        ...parsed,
        imageSources: message.imageSources,
      };
    }
    return parsed;
  }, [content, message.imageSources, message.role]);

  const [isEditing, setIsEditing] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [editValue, setEditValue] = useState(parsedContent.text);
  const [editAttachments, setEditAttachments] = useState<Attachment[]>(() =>
    parsedContent.imageSources.map((src, index) => toEditAttachment(src, index))
  );
  const [isComposing, setIsComposing] = useState(false);
  const [editMentions, setEditMentions] = useState<NoteMentionReference[]>([]);
  const [editCaretIndex, setEditCaretIndex] = useState(0);
  const [activeMentionIndex, setActiveMentionIndex] = useState(0);
  const [editTextareaScrollTop, setEditTextareaScrollTop] = useState(0);
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);

  const notesRootFolder = useNotesStore((state) => state.rootFolder);
  const currentNotePath = useNotesStore((state) => state.currentNote?.path ?? null);
  const notesPath = useNotesStore((state) => state.notesPath);
  const notesLoading = useNotesStore((state) => state.isLoading);
  const loadFileTree = useNotesStore((state) => state.loadFileTree);
  const getDisplayName = useNotesStore((state) => state.getDisplayName);

  const versions = message.versions;
  const currentIdx = message.currentVersionIndex;
  const hasMultipleVersions = versions.length > 1;

  const resetEditDraft = useCallback(() => {
    setEditValue(parsedContent.text);
    setEditAttachments(parsedContent.imageSources.map((src, index) => toEditAttachment(src, index)));
  }, [parsedContent]);

  useEffect(() => {
      if (!isEditing) {
        resetEditDraft();
        setEditMentions([]);
        setEditCaretIndex(0);
        setActiveMentionIndex(0);
      }
  }, [isEditing, resetEditDraft]);

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

  const mentionTrigger = useMemo(
    () => (isEditing ? getNoteMentionTrigger(editValue, editCaretIndex) : null),
    [editCaretIndex, editValue, isEditing]
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
    if (!isEditing || !mentionTrigger || mentionTrigger.start < 0) {
      return;
    }
    if (notesRootFolder || !notesPath || notesLoading) {
      return;
    }
    void loadFileTree();
  }, [isEditing, loadFileTree, mentionTrigger, notesLoading, notesPath, notesRootFolder]);

  useEffect(() => {
    if (!isEditing) {
      return;
    }
    setEditMentions(
      allNoteCandidates
        .filter((candidate) => editValue.includes(`@${candidate.title}`))
        .map((candidate) => ({ path: candidate.path, title: candidate.title }))
    );
  }, [allNoteCandidates, editValue, isEditing]);

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

  usePredictedTextareaHeight(editTextareaRef, {
    value: editValue,
    minHeight: 24,
    maxHeight: 320,
  });

  const removeEditMention = useCallback(
    (path: string, rangeStart?: number) => {
      const target = editMentions.find((mention) => mention.path === path);
      if (!target) {
        return;
      }
      const label = `@${target.title}`;
      const index = typeof rangeStart === 'number' ? rangeStart : editValue.indexOf(label);
      if (index < 0) {
        setEditMentions((prev) => prev.filter((mention) => mention.path !== path));
        return;
      }
      const nextValue = `${editValue.slice(0, index)}${editValue.slice(index + label.length)}`;
      setEditValue(nextValue);
      setEditCaretIndex(index);
      setEditMentions((prev) => prev.filter((mention) => mention.path !== path));
      requestAnimationFrame(() => {
        const input = editTextareaRef.current;
        if (!input) {
          return;
        }
        input.focus({ preventScroll: true });
        input.setSelectionRange(index, index);
      });
    },
    [editMentions, editValue]
  );

  const applyMentionCandidate = useCallback(
    (candidate: NoteMentionCandidate) => {
      if (!mentionTrigger) {
        return;
      }
      const { nextValue, nextCaret } = insertMentionAtTrigger(editValue, mentionTrigger, candidate.title);
      setEditValue(nextValue);
      setEditCaretIndex(-1);
      setEditMentions((prev) => {
        if (prev.some((mention) => mention.path === candidate.path)) {
          return prev;
        }
        return [...prev, { path: candidate.path, title: candidate.title }];
      });
      requestAnimationFrame(() => {
        const input = editTextareaRef.current;
        if (!input) {
          return;
        }
        input.focus({ preventScroll: true });
        input.setSelectionRange(nextCaret, nextCaret);
      });
    },
    [editValue, mentionTrigger]
  );

  const mentionPreviewParts = useMemo(
    () => buildMentionPreviewParts(editValue, editMentions),
    [editMentions, editValue]
  );

  const handleSave = () => {
      const normalized = composeUserMessageContent(editValue, editAttachments);
      const normalizedCurrent = content.replace(/\r\n?/g, '\n');
      if (normalized.trim() !== normalizedCurrent.trim()) {
          onEdit?.(message.id, normalized);
      }
      setIsEditing(false);
  };

  const handleCancel = () => {
      resetEditDraft();
      setIsEditing(false);
  };

  const handleRemoveEditAttachment = useCallback((id: string) => {
      setEditAttachments((prev) => prev.filter((attachment) => attachment.id !== id));
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const native = e.nativeEvent as KeyboardEvent & { isComposing?: boolean; keyCode?: number };
      const selectionStart = e.currentTarget.selectionStart ?? 0;
      const selectionEnd = e.currentTarget.selectionEnd ?? 0;
      const mentionRanges = mentionPreviewParts.filter(
        (part): part is MentionPreviewPart & { mention: NoteMentionReference } =>
          part.type === 'mention' && !!part.mention
      );

      if (e.key === 'Backspace' || e.key === 'Delete') {
        if (selectionStart !== selectionEnd) {
          const overlapped = mentionRanges.find(
            (part) => selectionStart < part.end && selectionEnd > part.start
          );
          if (overlapped) {
            e.preventDefault();
            removeEditMention(overlapped.mention.path, overlapped.start);
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
          removeEditMention(targetPart.mention.path, targetPart.start);
          return;
        }
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
              setEditCaretIndex(-1);
              return;
          }
      }

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

  const handleCopy = async () => {
      try {
          await copyMessageContentToClipboard(content);
          setIsCopied(true);
          setTimeout(() => setIsCopied(false), 2000);
      } catch (error) {
          console.error('[UserMessage] Failed to copy message:', error);
      }
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
          <div className={cn("w-full", chatComposerFrameClass, editComposerSurfaceClass)}>
            <ChatAttachmentPreviewList attachments={editAttachments} onRemove={handleRemoveEditAttachment} />
            <div className={chatComposerInputBlockClass}>
              <div className="relative">
                {showMentionPicker && (
                  <div
                    className="absolute left-0 right-0 bottom-full mb-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1d1d1d] shadow-xl p-2 max-h-72 overflow-y-auto z-40"
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
                                key={`edit-current-${candidate.path}`}
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
                                key={`edit-${candidate.path}`}
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
                <textarea
                  ref={editTextareaRef}
                  value={editValue}
                  onChange={(e) => {
                    setEditValue(e.target.value);
                    setEditCaretIndex(e.target.selectionStart ?? e.target.value.length);
                  }}
                  onCompositionStart={() => setIsComposing(true)}
                  onCompositionEnd={() => setIsComposing(false)}
                  onKeyDown={handleKeyDown}
                  onSelect={(e) => setEditCaretIndex(e.currentTarget.selectionStart ?? 0)}
                  onClick={(e) => setEditCaretIndex(e.currentTarget.selectionStart ?? 0)}
                  onBlur={() => setEditCaretIndex(-1)}
                  onScroll={(e) => setEditTextareaScrollTop(e.currentTarget.scrollTop)}
                  className={cn("p-0 m-0 border-0 relative z-10 w-full", chatComposerTextareaClass)}
                  rows={1}
                />
                {mentionPreviewParts.length > 0 && (
                  <div
                    className="pointer-events-none absolute inset-0 z-20 whitespace-pre-wrap break-words text-[15px] leading-6"
                    style={{ transform: `translateY(${-editTextareaScrollTop}px)` }}
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
                            onClick={() => removeEditMention(part.mention!.path, part.start)}
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

            <div className="flex justify-end items-center gap-2 px-2 pb-2 pr-3">
              <button
                onClick={handleCancel}
                className={cn(
                  chatComposerSecondaryButtonClass,
                  "h-8 px-3.5 text-[13px] bg-white hover:bg-white dark:bg-white dark:text-zinc-900 dark:hover:bg-white"
                )}
              >
                取消
              </button>
              <button
                onClick={handleSave}
                className={cn(
                  chatComposerPrimaryButtonClass,
                  "h-8 px-3.5 text-[13px] font-semibold hover:scale-100 active:scale-100"
                )}
              >
                发送
              </button>
            </div>
          </div>
        </motion.div>
      ) : (
        <div className="w-full flex flex-col items-end">
          <div className="w-full flex flex-col items-end gap-2">
            {parsedContent.imageSources.map((src) => (
              <div
                key={src}
                data-no-focus-input="true"
                className="rounded-xl overflow-hidden border border-black/5 dark:border-white/10 shadow-sm bg-white dark:bg-zinc-800"
              >
                <LocalImage
                  src={src}
                  alt="attachment"
                  className={cn(
                    "max-h-64 object-contain cursor-pointer hover:opacity-90 transition-opacity",
                    isSvgSource(src) ? "w-64 h-auto" : "max-w-xs"
                  )}
                  onClick={() => {
                    const safeExternalHref = normalizeExternalHref(src);
                    if (safeExternalHref) {
                      void openExternalHref(safeExternalHref);
                      return;
                    }
                    window.open(src, '_blank', 'noopener,noreferrer');
                  }}
                />
              </div>
            ))}
            {parsedContent.text && (
              <div
                data-no-focus-input="true"
                className="inline-block max-w-[90%] rounded-3xl bg-[#41a8ea] px-4 py-1.5 text-left text-[15px] leading-6 text-white"
              >
                <div className="whitespace-pre-wrap break-words">{parsedContent.text}</div>
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
                    resetEditDraft();
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
