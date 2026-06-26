import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  SUPPORTED_ATTACHMENT_INPUT_ACCEPT,
  type Attachment,
} from '@/lib/storage/attachmentStorage';
import type { NoteMentionReference } from '@/lib/ai/noteMentions';
import { authorizeExternalNoteMentionPath } from '@/lib/ai/authorizedExternalNoteMentions';
import {
  chatComposerFrameClass,
  chatComposerSurfaceClass,
} from './composerStyles';
import { limitChatComposerText } from '@/lib/ui/composerTextLimit';
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
import { focusVisibleTextareaAt, insertTextIntoComposer } from '@/lib/ui/composerFocusRegistry';
import {
  getBlockDragComposerPayload,
  subscribeBlockDragVisualState,
} from '@/components/Notes/features/Editor/plugins/cursor/blockDragVisualState';
import {
  FILE_TREE_CHAT_DROP_EVENT,
  FILE_TREE_CHAT_DROP_TARGET_SELECTOR,
  useFileTreePointerDragState,
  type FileTreeChatDropDetail,
} from '@/components/Notes/features/FileTree/hooks/fileTreePointerDragState';
import { getCurrentVaultPath, useNotesStore } from '@/stores/notes/useNotesStore';
import { shouldMarkPastedTextMultiline } from './chatPasteText';
import { markBillingReturnRefreshPending } from '@/lib/billing/returnRefresh';
import { openExternalHref } from '@/lib/navigation/externalLinks';
import { getDroppedExternalPaths } from '@/components/Notes/hooks/externalDropPayload';
import { normalizeContainedAssetPath } from '@/lib/assets/core/pathContainment';
import { isSupportedMarkdownPath, stripSupportedMarkdownExtension } from '@/lib/notes/markdownFile';
import { normalizeVaultRelativePath } from '@/stores/notes/utils/fs/vaultPathContainment';
import { useVaultStore } from '@/stores/useVaultStore';

interface ChatInputProps {
  active?: boolean;
  onSend: (message: string, attachments: Attachment[], noteMentions: NoteMentionReference[]) => void | boolean | Promise<void | boolean>;
  onStop: () => void;
  onStopAndRecall?: (lastSubmittedMessage?: string) => RecalledChatInputDraft | string | null | void;
  isLoading: boolean;
  hasSelectedModel: boolean;
  isManagedQuotaExhausted?: boolean;
  focusTrigger?: number;
  sessionId?: string | null;
  sentUserMessages: string[];
  acceptNotesBlockDrop?: boolean;
}

interface RecalledChatInputDraft {
  message: string;
  attachments?: Attachment[];
  noteMentions?: NoteMentionReference[];
}

const managedQuotaNoticeFrameClass =
  'overflow-hidden rounded-[var(--vlaina-radius-26px)] bg-[var(--vlaina-color-accent-soft)] shadow-[0_10px_26px_color-mix(in_srgb,var(--vlaina-accent)_12%,transparent)]';
const managedQuotaNoticeSurfaceClass =
  'flex min-h-[var(--vlaina-size-32px)] flex-wrap items-center justify-center gap-x-1.5 gap-y-1 px-6 pb-2.5 pt-1.5 text-center text-[var(--vlaina-font-12)] font-semibold leading-4 text-[var(--vlaina-accent)]';
const CHAT_DROP_REGION_SELECTOR = '[data-chat-view-mode],[data-notes-chat-panel="true"],[data-chat-input="true"]';

function normalizeDroppedPathForCompare(path: string): string {
  const normalized = path.replace(/\\/g, '/');
  return normalized === '/' ? normalized : normalized.replace(/\/+$/, '');
}

function compareDroppedPath(path: string): string {
  return /^[A-Za-z]:/.test(path) || path.startsWith('//') ? path.toLowerCase() : path;
}

function getDroppedVaultRelativePath(absolutePath: string, vaultPath: string): string | null {
  const containedPath = normalizeContainedAssetPath(absolutePath, vaultPath);
  if (!containedPath) {
    return null;
  }

  const rootPath = normalizeDroppedPathForCompare(vaultPath);
  const candidatePath = normalizeDroppedPathForCompare(containedPath);
  const rootComparePath = compareDroppedPath(rootPath);
  const candidateComparePath = compareDroppedPath(candidatePath);
  if (candidateComparePath === rootComparePath) {
    return null;
  }
  if (!candidateComparePath.startsWith(`${rootComparePath === '/' ? '' : rootComparePath}/`)) {
    return null;
  }

  const relativePath = rootPath === '/'
    ? candidatePath.slice(1)
    : candidatePath.slice(rootPath.length + 1);
  return normalizeVaultRelativePath(relativePath);
}

function buildDroppedNoteMentions(
  dataTransfer: DataTransfer | null | undefined,
  vaultPath: string,
  getDisplayName: (path: string) => string,
): NoteMentionReference[] {
  const seenPaths = new Set<string>();
  const mentions: NoteMentionReference[] = [];
  for (const absolutePath of getDroppedExternalPaths(dataTransfer)) {
    const relativePath = vaultPath ? getDroppedVaultRelativePath(absolutePath, vaultPath) : null;
    const mentionPath = relativePath ?? absolutePath;
    if (!isSupportedMarkdownPath(mentionPath) || seenPaths.has(mentionPath)) {
      continue;
    }
    seenPaths.add(mentionPath);
    if (!relativePath) {
      authorizeExternalNoteMentionPath(absolutePath);
    }
    mentions.push({
      path: mentionPath,
      title: relativePath ? getDisplayName(relativePath) : getDroppedExternalMarkdownTitle(absolutePath),
      kind: 'note',
    });
  }
  return mentions;
}

function getDroppedExternalMarkdownTitle(path: string): string {
  const name = path.replace(/\\/g, '/').split('/').filter(Boolean).pop() ?? path;
  return stripSupportedMarkdownExtension(name);
}

function isInsideChatDropRegion(event: DragEvent): boolean {
  if (
    event.target instanceof Element &&
    event.target.closest(CHAT_DROP_REGION_SELECTOR)
  ) {
    return true;
  }

  const elements = document.elementsFromPoint?.(event.clientX, event.clientY) ?? [];
  return elements.some((element) => (
    element instanceof Element &&
    element.closest(CHAT_DROP_REGION_SELECTOR)
  ));
}

export const ChatInput = memo(function ChatInput({
  active = true,
  onSend,
  onStop,
  onStopAndRecall,
  isLoading,
  hasSelectedModel,
  isManagedQuotaExhausted = false,
  focusTrigger,
  sessionId,
  sentUserMessages,
  acceptNotesBlockDrop = false,
}: ChatInputProps) {
  const { t } = useI18n();
  const focusRafRef = useRef<number | null>(null);
  const restoreFocusListenerRef = useRef<(() => void) | null>(null);
  const lastSubmittedMessageRef = useRef('');
  const [isBlockDropActive, setIsBlockDropActive] = useState(false);
  const [isFileTreeDropActive, setIsFileTreeDropActive] = useState(false);
  const isFileTreeDragActive = useFileTreePointerDragState((state) => state.activeSourcePath !== null);
  const getDisplayName = useNotesStore((state) => state.getDisplayName);
  const notesPath = useNotesStore((state) => state.notesPath);
  const activeVaultPath = useVaultStore((state) => state.currentVault?.path ?? null);
  const { webSearchEnabled, setWebSearchEnabled } = useAIStore();
  const isQuotaSendBlocked = hasSelectedModel && isManagedQuotaExhausted;
  const {
    attachments,
    isDragging,
    fileInputRef,
    handlePaste,
    handleDrop: handleAttachmentDrop,
    handleDragEnter,
    handleDragOver,
    handleDragLeave,
    handleFileChange,
    triggerFileSelect,
    removeAttachment,
    clearAttachments,
    clearDragState,
    restoreAttachments,
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
      const accepted = await onSend(text, nextAttachments, nextNoteMentions);
      if (accepted !== false) {
        lastSubmittedMessageRef.current = text;
      }
      return accepted;
    },
    attachments,
    getNoteMentions: () => noteMentions,
    onAfterSend: () => {
      clearAttachments();
      clearNoteMentions();
    },
    canSubmit: hasSelectedModel && !isQuotaSendBlocked,
    focusTrigger,
  });

  const handleTextareaPaste = useCallback(
    (e: React.ClipboardEvent) => {
      if (shouldMarkPastedTextMultiline(e.clipboardData.getData('text/plain'))) {
        markExplicitMultiline();
      }
      void handlePaste(e).catch(() => undefined);
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
      if (!focusVisibleTextareaAt(input, position)) {
        return;
      }
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
    folderCandidates,
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
    appendNoteMentions,
    restoreNoteMentions,
  } = useNoteMentions({
    message,
    textareaRef,
    handleMessageChange,
  });

  const applyHistoryMessage = useCallback(
    (nextMessage: string) => {
      const limitedMessage = limitChatComposerText(nextMessage);
      if (limitedMessage.includes('\n')) {
        markExplicitMultiline();
      }
      handleMessageChange(limitedMessage);
      const nextCaret = limitedMessage.length;
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

  const buildDroppedFileTreeMentions = useCallback(
    (detail: FileTreeChatDropDetail): NoteMentionReference[] => {
      const title = detail.kind === 'folder'
        ? `${detail.path.split('/').filter(Boolean).pop() ?? detail.path}/`
        : getDisplayName(detail.path);
      return [{
        path: detail.path,
        title,
        kind: detail.kind === 'folder' ? 'folder' : 'note',
      }];
    },
    [getDisplayName],
  );

  useEffect(() => {
    if (!active) {
      setIsFileTreeDropActive(false);
      return;
    }

    const isInsideDropTarget = (event: PointerEvent | MouseEvent) => {
      const root = composerRootRef.current?.closest(FILE_TREE_CHAT_DROP_TARGET_SELECTOR) as HTMLElement | null;
      if (!root) {
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

    const handlePointerMove = (event: PointerEvent) => {
      setIsFileTreeDropActive(isFileTreeDragActive && isInsideDropTarget(event));
    };

    const handlePointerUp = () => {
      setIsFileTreeDropActive(false);
    };

    const handleFileTreeChatDrop = (event: Event) => {
      const detail = (event as CustomEvent<FileTreeChatDropDetail>).detail;
      if (!detail?.path) {
        return;
      }
      appendNoteMentions(buildDroppedFileTreeMentions(detail));
      resetHistoryNavigation();
      clearHistoryNavigationOnInput();
      setIsFileTreeDropActive(false);
    };

    window.addEventListener('pointermove', handlePointerMove, true);
    window.addEventListener('pointerup', handlePointerUp, true);
    window.addEventListener(FILE_TREE_CHAT_DROP_EVENT, handleFileTreeChatDrop);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove, true);
      window.removeEventListener('pointerup', handlePointerUp, true);
      window.removeEventListener(FILE_TREE_CHAT_DROP_EVENT, handleFileTreeChatDrop);
      setIsFileTreeDropActive(false);
    };
  }, [
    active,
    appendNoteMentions,
    buildDroppedFileTreeMentions,
    clearHistoryNavigationOnInput,
    composerRootRef,
    isFileTreeDragActive,
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

  const applyDroppedNoteMentions = useCallback((dataTransfer: DataTransfer | null | undefined) => {
    const effectiveVaultPath = notesPath || activeVaultPath || getCurrentVaultPath() || '';
    const droppedNoteMentions = buildDroppedNoteMentions(
      dataTransfer,
      effectiveVaultPath,
      getDisplayName,
    );
    if (droppedNoteMentions.length === 0) {
      return false;
    }

    clearDragState();
    appendNoteMentions(droppedNoteMentions);
    resetHistoryNavigation();
    clearHistoryNavigationOnInput();
    return true;
  }, [
    activeVaultPath,
    appendNoteMentions,
    clearDragState,
    clearHistoryNavigationOnInput,
    getDisplayName,
    notesPath,
    resetHistoryNavigation,
  ]);

  const handleComposerDrop = useCallback(
    async (event: React.DragEvent<HTMLDivElement>) => {
      if (applyDroppedNoteMentions(event.dataTransfer)) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      await handleAttachmentDrop(event);
    },
    [
      applyDroppedNoteMentions,
      handleAttachmentDrop,
    ]
  );

  const handleComposerDropCapture = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      if (!applyDroppedNoteMentions(event.dataTransfer)) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
    },
    [applyDroppedNoteMentions]
  );

  useEffect(() => {
    const handleWindowDropCapture = (event: DragEvent) => {
      if (event.defaultPrevented || !isInsideChatDropRegion(event)) {
        return;
      }
      if (!applyDroppedNoteMentions(event.dataTransfer)) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
    };

    window.addEventListener('drop', handleWindowDropCapture, true);
    return () => window.removeEventListener('drop', handleWindowDropCapture, true);
  }, [applyDroppedNoteMentions]);

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

  const handleTriggerMentionSelect = useCallback(() => {
    const input = textareaRef.current;
    const selectionStart = input?.selectionStart ?? message.length;
    const selectionEnd = input?.selectionEnd ?? selectionStart;
    const before = message.slice(0, selectionStart);
    const after = message.slice(selectionEnd);
    const prefix = before && !/\s$/.test(before) ? ' ' : '';
    const nextMessage = limitChatComposerText(`${before}${prefix}@${after}`);
    const nextCaret = Math.min(before.length + prefix.length + 1, nextMessage.length);

    handleMessageChange(nextMessage);
    clearHistoryNavigationOnInput();
    handleCaretChange(nextCaret);
    scheduleComposerFocus(nextCaret);
  }, [
    clearHistoryNavigationOnInput,
    handleCaretChange,
    handleMessageChange,
    message,
    scheduleComposerFocus,
    textareaRef,
  ]);

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
  const canSubmit = canSend && !isLoading && !isQuotaSendBlocked;
  const handleComposerChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      const nextValue = limitChatComposerText(event.target.value);
      handleMessageChange(nextValue);
      clearHistoryNavigationOnInput();
      handleCaretChange(Math.min(event.target.selectionStart ?? nextValue.length, nextValue.length));
    },
    [clearHistoryNavigationOnInput, handleCaretChange, handleMessageChange]
  );

  const handleUpgradeClick = useCallback(() => {
    markBillingReturnRefreshPending();
    void openExternalHref('https://vlaina.com/r/spark_continue');
  }, []);

  const handleStopButton = useCallback(() => {
    if (!onStopAndRecall) {
      onStop();
      return;
    }

    const recalled = onStopAndRecall(lastSubmittedMessageRef.current);
    const recalledDraft = typeof recalled === 'string'
      ? { message: recalled }
      : recalled;
    if (!recalledDraft || typeof recalledDraft.message !== 'string') {
      return;
    }

    const recalledMessage = limitChatComposerText(recalledDraft.message);
    const recalledAttachments = recalledDraft.attachments ?? [];
    const recalledNoteMentions = recalledDraft.noteMentions ?? [];
    if (
      recalledMessage.trim().length === 0 &&
      recalledAttachments.length === 0 &&
      recalledNoteMentions.length === 0
    ) {
      return;
    }

    restoreAttachments(recalledAttachments);
    restoreNoteMentions(recalledNoteMentions);
    if (recalledMessage.includes('\n')) {
      markExplicitMultiline();
    }
    handleMessageChange(recalledMessage);
    clearHistoryNavigationOnInput();
    const nextCaret = recalledMessage.length;
    handleCaretChange(nextCaret);
    scheduleComposerFocus(nextCaret);
  }, [
    clearHistoryNavigationOnInput,
    handleCaretChange,
    handleMessageChange,
    markExplicitMultiline,
    onStop,
    onStopAndRecall,
    restoreAttachments,
    restoreNoteMentions,
    scheduleComposerFocus,
  ]);

  return (
    <>
      <input
        type="file"
        spellCheck={false}
        multiple
        accept={SUPPORTED_ATTACHMENT_INPUT_ACCEPT}
        className="hidden"
        ref={fileInputRef}
        onChange={handleHiddenFileInputChange}
      />

      <div className={cn('relative z-[var(--vlaina-z-10)]', isQuotaSendBlocked && managedQuotaNoticeFrameClass)}>
        <div
          data-chat-input="true"
          ref={composerRootRef}
          className={cn(
            'relative z-[var(--vlaina-z-10)]',
            chatComposerFrameClass,
            chatComposerSurfaceClass,
            isQuotaSendBlocked && [
              '!shadow-none',
              'hover:!shadow-none',
            ]
          )}
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDropCapture={handleComposerDropCapture}
          onDrop={handleComposerDrop}
        >
          {(isDragging || isBlockDropActive || isFileTreeDropActive) && (
            <div
              className={cn(
                "absolute inset-0 z-[var(--vlaina-z-20)] flex items-center justify-center rounded-[var(--vlaina-radius-32px)] border-2 border-dashed backdrop-blur-[var(--vlaina-backdrop-blur-sm)] pointer-events-none",
                isBlockDropActive || isFileTreeDropActive
                  ? "border-[var(--vlaina-color-accent)] bg-[var(--vlaina-color-accent-soft)]"
                  : "border-[var(--vlaina-color-subtle-border-strong)] bg-[var(--vlaina-color-overlay-weak)]"
              )}
            >
              <span
                className={cn(
                  "font-medium",
                  isBlockDropActive || isFileTreeDropActive
                    ? "text-[var(--vlaina-color-accent)]"
                    : "text-[var(--vlaina-sidebar-chat-text-muted)]"
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
                folderCandidates={folderCandidates}
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
              onSelect={(e) => handleCaretChange(
                e.currentTarget.selectionStart ?? 0,
                e.currentTarget.selectionEnd ?? e.currentTarget.selectionStart ?? 0,
              )}
              onClick={(e) => handleCaretChange(
                e.currentTarget.selectionStart ?? 0,
                e.currentTarget.selectionEnd ?? e.currentTarget.selectionStart ?? 0,
              )}
              onBlur={handleCaretBlur}
              onPaste={handleTextareaPaste}
              onScroll={(e) => setTextareaScrollTop(e.currentTarget.scrollTop)}
              placeholder={!hasSelectedModel ? t('chat.selectModelPlaceholder') : t('chat.composerPlaceholder')}
              mentionPreviewParts={mentionPreviewParts}
              textareaScrollTop={textareaScrollTop}
              onFocusMentionEnd={handleCaretChange}
              onRemoveMention={removeNoteMention}
            />

            <ChatInputActions
              onTriggerFileSelect={handleTriggerFileSelect}
              onTriggerMentionSelect={handleTriggerMentionSelect}
              isLoading={isLoading}
              canSend={canSend}
              canSubmit={canSubmit}
              showSendReadyState={!isQuotaSendBlocked && canSend}
              webSearchEnabled={webSearchEnabled}
              onToggleWebSearch={() => setWebSearchEnabled(!webSearchEnabled)}
              onRequestComposerFocus={scheduleComposerFocus}
              onStop={handleStopButton}
              onSend={() => handleSend()}
            />
          </div>
        </div>
        {isQuotaSendBlocked && (
          <div
            data-managed-quota-banner="true"
            className={managedQuotaNoticeSurfaceClass}
          >
            <span>{t('chat.freeRepliesExhausted')}</span>
            <button
              type="button"
              onClick={handleUpgradeClick}
              data-no-focus-input="true"
              className="cursor-pointer font-bold text-[var(--vlaina-accent)] underline decoration-[var(--vlaina-accent)]/45 underline-offset-4 transition-colors hover:text-[var(--vlaina-accent-hover)]"
            >
              {t('chat.upgradeVlaina')}
            </button>
          </div>
        )}
      </div>
    </>
  );
});
