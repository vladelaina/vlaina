import { useState, useCallback, useRef, useEffect } from 'react';
import { useNotesStore } from '@/stores/useNotesStore';
import { useUIStore } from '@/stores/uiSlice';
import { focusEditorToFirstLineEnd } from './utils/focusEditor';
import { NOTE_TITLE_INPUT_DATA_ATTR } from './utils/titleInputDom';
import { registerCurrentTitleCommitter } from './utils/titleCommitRegistry';
import { isDraftNotePath, resolveDraftNoteTitle } from '@/stores/notes/draftNote';
import { isAbsolutePath } from '@/lib/storage/adapter';
import { useI18n } from '@/lib/i18n';
import { getInvalidFileNameReason } from '@/stores/notes/noteUtils';
import { useToastStore } from '@/stores/useToastStore';
import { requestNativeCaretOverlayRefresh } from '@/hooks/useNativeCaretOverlay';
import { themeUiFeedbackTokens } from '@/styles/themeTokens';
import { clearCurrentEditorBlockSelection } from './utils/editorViewRegistry';
import { useTitleInputAutoResize } from './hooks/useTitleInputAutoResize';

interface TitleInputProps {
  notePath: string;
  initialTitle: string;
  onEnter?: () => void;
  autoFocus?: boolean;
  compact?: boolean;
}

export function TitleInput({ notePath, initialTitle, onEnter, autoFocus, compact = false }: TitleInputProps) {
  const { t } = useI18n();
  const [title, setTitle] = useState(initialTitle);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const skipNextBlurCommitRef = useRef(false);
  const isCommittingRef = useRef(false);
  const titleActionFrameRef = useRef<number | null>(null);
  const lastInvalidToastAtRef = useRef(0);
  const commitTitleRef = useRef<() => Promise<void>>(async () => undefined);
  const isComposingRef = useRef(false);
  const renameNote = useNotesStore(s => s.renameNote);
  const renameAbsoluteNote = useNotesStore(s => s.renameAbsoluteNote);
  const updateDraftNoteName = useNotesStore(s => s.updateDraftNoteName);
  const saveNote = useNotesStore(s => s.saveNote);
  const setNotesPreviewTitle = useUIStore(s => s.setNotesPreviewTitle);
  const addToast = useToastStore(s => s.addToast);
  const titleInputDataAttrs = { [NOTE_TITLE_INPUT_DATA_ATTR]: 'true' as const };

  const resizeTitleInput = useTitleInputAutoResize(inputRef, title);

  const showInvalidFileNameToast = useCallback((message: string) => {
    const now = Date.now();
    if (now - lastInvalidToastAtRef.current < themeUiFeedbackTokens.invalidFileNameToastIntervalMs) {
      return;
    }

    lastInvalidToastAtRef.current = now;
    addToast(message, 'error', themeUiFeedbackTokens.invalidFileNameToastDurationMs);
  }, [addToast]);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      if (titleActionFrameRef.current !== null) {
        cancelAnimationFrame(titleActionFrameRef.current);
      }
      titleActionFrameRef.current = requestAnimationFrame(() => {
        titleActionFrameRef.current = null;
        if (inputRef.current) {
          resizeTitleInput();
          inputRef.current.focus();
          const titleLength = inputRef.current.value.length;
          inputRef.current.setSelectionRange(titleLength, titleLength);
          requestNativeCaretOverlayRefresh();
        }
      });
    }
  }, [autoFocus, initialTitle, notePath, resizeTitleInput]);

  useEffect(() => {
    if (inputRef.current === document.activeElement || isCommittingRef.current) {
      return;
    }

    setTitle(initialTitle);
  }, [initialTitle]);

  useEffect(() => {
    return () => {
      setNotesPreviewTitle(null, null);
    };
  }, [setNotesPreviewTitle]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newTitle = e.target.value;
    const invalidReason = newTitle.trim() ? getInvalidFileNameReason(newTitle) : null;
    if (invalidReason) {
      showInvalidFileNameToast(invalidReason);
      return;
    }

    setTitle(newTitle);
    if (newTitle.trim()) {
      setNotesPreviewTitle(notePath, newTitle.trim());
    } else {
      setNotesPreviewTitle(null, null);
    }
  }, [notePath, setNotesPreviewTitle, showInvalidFileNameToast]);

  const handleTitleInteraction = useCallback(() => {
    clearCurrentEditorBlockSelection();
  }, []);

  const commitTitleIfNeeded = useCallback(async () => {
    if (isCommittingRef.current) return;
    if (isComposingRef.current) return;
    const trimmed = title.trim();
    if (!trimmed) {
      if (isDraftNotePath(notePath)) {
        updateDraftNoteName(notePath, '');
        if (useNotesStore.getState().notesPath) {
          await saveNote({ explicit: false });
        }
      }
      setTitle('');
      setNotesPreviewTitle(null, null);
      return;
    }

    if (trimmed === initialTitle) {
      setNotesPreviewTitle(null, null);
      return;
    }

    const invalidReason = getInvalidFileNameReason(trimmed);
    if (invalidReason) {
      showInvalidFileNameToast(invalidReason);
      return;
    }

    isCommittingRef.current = true;
    try {
      if (isDraftNotePath(notePath)) {
        updateDraftNoteName(notePath, trimmed);
        if (useNotesStore.getState().notesPath) {
          await saveNote({ explicit: false });
        }
        setTitle(resolveDraftNoteTitle(trimmed));
        return;
      }

      if (isAbsolutePath(notePath)) {
        await renameAbsoluteNote(notePath, trimmed);
      } else {
        await renameNote(notePath, trimmed);
      }
    } finally {
      isCommittingRef.current = false;
      setNotesPreviewTitle(null, null);
    }
  }, [title, initialTitle, notePath, renameAbsoluteNote, renameNote, saveNote, setNotesPreviewTitle, showInvalidFileNameToast, updateDraftNoteName]);

  commitTitleRef.current = commitTitleIfNeeded;

  useEffect(() => {
    return registerCurrentTitleCommitter(() => commitTitleRef.current());
  }, []);

  const handleBlur = useCallback(async () => {
    if (skipNextBlurCommitRef.current) {
      skipNextBlurCommitRef.current = false;
      setNotesPreviewTitle(null, null);
      return;
    }

    await commitTitleIfNeeded();
  }, [commitTitleIfNeeded, setNotesPreviewTitle]);

  const runAfterTitleCommit = useCallback((callback: () => void) => {
    skipNextBlurCommitRef.current = true;
    if (titleActionFrameRef.current !== null) {
      cancelAnimationFrame(titleActionFrameRef.current);
    }
    titleActionFrameRef.current = requestAnimationFrame(() => {
      titleActionFrameRef.current = null;
      callback();
    });
  }, []);

  const handleKeyDown = useCallback(async (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.nativeEvent.isComposing) {
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      await commitTitleIfNeeded();
      runAfterTitleCommit(() => {
        onEnter?.();
      });
    } else if (
      e.key === 'ArrowDown' &&
      !e.shiftKey &&
      !e.ctrlKey &&
      !e.metaKey &&
      !e.altKey
    ) {
      e.preventDefault();
      await commitTitleIfNeeded();
      runAfterTitleCommit(() => {
        focusEditorToFirstLineEnd();
      });
    } else if (e.key === 'Escape') {
      skipNextBlurCommitRef.current = false;
      setTitle(initialTitle);
      setNotesPreviewTitle(null, null);
      inputRef.current?.blur();
    }
  }, [commitTitleIfNeeded, initialTitle, onEnter, runAfterTitleCommit, setNotesPreviewTitle]);

  useEffect(() => {
    skipNextBlurCommitRef.current = false;
  }, [notePath]);

  useEffect(() => {
    return () => {
      if (titleActionFrameRef.current !== null) {
        cancelAnimationFrame(titleActionFrameRef.current);
        titleActionFrameRef.current = null;
      }
      isCommittingRef.current = false;
      skipNextBlurCommitRef.current = false;
    };
  }, []);

  return (
    <textarea
      ref={inputRef}
      {...titleInputDataAttrs}
      rows={1}
      wrap="soft"
      spellCheck={false}
      value={title}
      onChange={handleChange}
      onCompositionStart={() => {
        isComposingRef.current = true;
      }}
      onCompositionEnd={() => {
        isComposingRef.current = false;
      }}
      onFocus={handleTitleInteraction}
      onPointerDown={handleTitleInteraction}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className="block w-full resize-none overflow-hidden bg-transparent border-none outline-none text-[var(--vlaina-note-title-font-size)] font-bold leading-[var(--vlaina-leading-title)] tracking-normal text-[var(--vlaina-text-primary)] placeholder:text-[var(--vlaina-soft-placeholder)] selection:bg-[var(--vlaina-selection-bg)] selection:text-[var(--vlaina-color-white)]"
      style={compact ? {
        fontSize: 'var(--vlaina-text-xl)',
        lineHeight: 'var(--vlaina-size-28px)',
      } : undefined}
      placeholder={t('notes.untitled')}
    />
  );
}
