import { useCallback, useEffect, useRef, type MouseEvent as ReactMouseEvent } from 'react';
import { useNotesStore } from '@/stores/useNotesStore';
import { cn } from '@/lib/utils';
import { useI18n } from '@/lib/i18n';
import { EDITOR_LAYOUT_CLASS } from '@/lib/layout';
import {
  flushPendingEditorMarkdown,
  setPendingEditorMarkdownFlusher,
} from '@/stores/notes/pendingEditorMarkdown';
import { themeEditorLayoutTokens } from '@/styles/themeTokens';
import { focusCurrentEmptyUntitledDraftTitle } from './utils/emptyUntitledDraftTitleFocus';

const NOTE_SCROLL_ROOT_SELECTOR = '[data-note-scroll-root="true"]';

export function MarkdownSourceEditor({
  currentNotePath,
  showBodyLineNumbers,
  saveNote,
  mode,
}: {
  currentNotePath: string;
  showBodyLineNumbers: boolean;
  saveNote: (options?: { explicit?: boolean }) => Promise<void>;
  mode: 'source' | 'fallback';
}) {
  const { t } = useI18n();
  const updateContent = useNotesStore((state) => state.updateContent);
  const currentNoteContent = useNotesStore(
    useCallback((state) => (
      state.currentNote?.path === currentNotePath ? state.currentNote.content : ''
    ), [currentNotePath])
  );
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const draftRef = useRef(currentNoteContent);
  const committedDraftRef = useRef(currentNoteContent);
  const lastFlushedSourceDraftRef = useRef<{ path: string; markdown: string }>({
    path: currentNotePath,
    markdown: currentNoteContent,
  });
  const isComposingRef = useRef(false);
  const saveTimerRef = useRef<number | null>(null);
  const textareaResizeFrameRef = useRef<number | null>(null);
  const contentCommitFrameRef = useRef<number | null>(null);

  const updateContentIfCurrentNoteIsActive = useCallback((markdown: string) => {
    if (useNotesStore.getState().currentNote?.path !== currentNotePath) {
      return;
    }
    updateContent(markdown);
  }, [currentNotePath, updateContent]);

  const clearPendingSave = useCallback(() => {
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
  }, []);

  const resizeTextareaToContent = useCallback(() => {
    textareaResizeFrameRef.current = null;
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    textarea.style.height = 'auto';
    textarea.style.height = `${Math.max(textarea.scrollHeight, textarea.clientHeight)}px`;
  }, []);

  const scheduleTextareaResize = useCallback(() => {
    if (textareaResizeFrameRef.current !== null) {
      return;
    }

    textareaResizeFrameRef.current = window.requestAnimationFrame(resizeTextareaToContent);
  }, [resizeTextareaToContent]);

  const flushScheduledContentCommit = useCallback(() => {
    if (contentCommitFrameRef.current !== null) {
      window.cancelAnimationFrame(contentCommitFrameRef.current);
      contentCommitFrameRef.current = null;
    }

    updateContentIfCurrentNoteIsActive(committedDraftRef.current);
  }, [updateContentIfCurrentNoteIsActive]);

  const scheduleContentCommit = useCallback(() => {
    if (contentCommitFrameRef.current !== null) {
      return;
    }

    contentCommitFrameRef.current = window.requestAnimationFrame(() => {
      contentCommitFrameRef.current = null;
      updateContentIfCurrentNoteIsActive(committedDraftRef.current);
    });
  }, [updateContentIfCurrentNoteIsActive]);

  useEffect(() => {
    if (textareaRef.current && textareaRef.current.value !== currentNoteContent) {
      textareaRef.current.value = currentNoteContent;
    }
    draftRef.current = currentNoteContent;
    committedDraftRef.current = currentNoteContent;
    lastFlushedSourceDraftRef.current = {
      path: currentNotePath,
      markdown: currentNoteContent,
    };
    scheduleTextareaResize();
  }, [currentNoteContent, currentNotePath, scheduleTextareaResize]);

  useEffect(() => {
    return clearPendingSave;
  }, [clearPendingSave, currentNotePath]);

  useEffect(() => {
    scheduleTextareaResize();
    return () => {
      if (textareaResizeFrameRef.current !== null) {
        window.cancelAnimationFrame(textareaResizeFrameRef.current);
        textareaResizeFrameRef.current = null;
      }
      if (contentCommitFrameRef.current !== null) {
        window.cancelAnimationFrame(contentCommitFrameRef.current);
        contentCommitFrameRef.current = null;
      }
    };
  }, [scheduleTextareaResize]);

  const flushSourceDraft = useCallback((options: { force?: boolean } = {}) => {
    if (isComposingRef.current && !options.force) {
      return false;
    }
    const markdown = isComposingRef.current ? committedDraftRef.current : draftRef.current;
    if (!isComposingRef.current) {
      committedDraftRef.current = markdown;
      flushScheduledContentCommit();
    }

    const lastFlushedDraft = lastFlushedSourceDraftRef.current;
    if (lastFlushedDraft.path === currentNotePath && lastFlushedDraft.markdown === markdown) {
      return true;
    }

    const didFlush = flushPendingEditorMarkdown(currentNotePath, markdown);
    if (didFlush || useNotesStore.getState().currentNote?.path === currentNotePath) {
      lastFlushedSourceDraftRef.current = {
        path: currentNotePath,
        markdown,
      };
      return true;
    }

    return false;
  }, [currentNotePath, flushScheduledContentCommit]);

  useEffect(() => {
    const unregisterPendingMarkdownFlusher = setPendingEditorMarkdownFlusher(flushSourceDraft);
    return () => {
      flushSourceDraft({ force: true });
      unregisterPendingMarkdownFlusher();
    };
  }, [flushSourceDraft]);

  useEffect(() => {
    return () => {
      flushSourceDraft({ force: true });
      clearPendingSave();
      if (mode === 'source') {
        void saveNote({ explicit: false }).catch(() => undefined);
      }
    };
  }, [clearPendingSave, flushSourceDraft, mode, saveNote]);

  const scheduleSave = useCallback(() => {
    clearPendingSave();
    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null;
      void saveNote({ explicit: false }).catch(() => undefined);
    }, themeEditorLayoutTokens.autoSaveDebounceMs);
  }, [clearPendingSave, saveNote]);

  const flushSave = useCallback(() => {
    flushSourceDraft({ force: true });
    clearPendingSave();
    void saveNote({ explicit: false }).catch(() => undefined);
  }, [clearPendingSave, flushSourceDraft, saveNote]);

  const handleSourceMouseDownCapture = useCallback((event: ReactMouseEvent<HTMLTextAreaElement>) => {
    if (event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;

    if (focusCurrentEmptyUntitledDraftTitle(
      event.currentTarget.closest(NOTE_SCROLL_ROOT_SELECTOR) ?? event.currentTarget.ownerDocument,
    )) {
      event.preventDefault();
    }
  }, []);

  return (
    <div
      className={cn(
        'milkdown-editor theme-vlaina is-live-preview max is-readable-line-width min-h-[var(--vlaina-height-editor-min)]',
        showBodyLineNumbers && 'markdown-body-line-numbers',
        EDITOR_LAYOUT_CLASS
      )}
      data-note-content-root="true"
      data-markdown-theme-root="true"
      data-markdown-theme-platform="vlaina"
      data-markdown-compat="native"
      data-markdown-compat-layer="native"
      data-note-source-editor-mode={mode}
      data-note-source-fallback={mode === 'fallback' ? 'true' : undefined}
      data-note-source-mode={mode === 'source' ? 'true' : undefined}
    >
      <textarea
        ref={textareaRef}
        data-note-source-editor="true"
        defaultValue={currentNoteContent}
        onCompositionStart={() => {
          isComposingRef.current = true;
        }}
        onCompositionEnd={(event) => {
          isComposingRef.current = false;
          const nextValue = event.currentTarget.value;
          draftRef.current = nextValue;
          committedDraftRef.current = nextValue;
          if (mode === 'fallback') {
            updateContent(nextValue);
          } else {
            scheduleContentCommit();
          }
          scheduleTextareaResize();
          scheduleSave();
        }}
        onChange={(event) => {
          const nextValue = event.currentTarget.value;
          draftRef.current = nextValue;
          scheduleTextareaResize();
          if (isComposingRef.current || Boolean((event.nativeEvent as InputEvent).isComposing)) {
            return;
          }
          committedDraftRef.current = nextValue;
          if (mode === 'fallback') {
            updateContent(nextValue);
          } else {
            scheduleContentCommit();
          }
          scheduleSave();
        }}
        onBlur={flushSave}
        onMouseDownCapture={handleSourceMouseDownCapture}
        spellCheck={false}
        aria-label={t('editor.markdownSourceEditor')}
        className="block min-h-[var(--vlaina-height-prosemirror-min)] w-full resize-none overflow-hidden bg-transparent px-0 py-2 pb-[var(--vlaina-height-prosemirror-bottom-padding)] font-mono text-sm leading-6 text-[var(--vlaina-text-primary)] outline-none"
      />
    </div>
  );
}
