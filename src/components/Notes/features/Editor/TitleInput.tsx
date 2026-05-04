import { useState, useCallback, useRef, useEffect } from 'react';
import { useNotesStore } from '@/stores/useNotesStore';
import { useUIStore } from '@/stores/uiSlice';
import { focusEditorToFirstLineStart } from './utils/focusEditor';
import { NOTE_TITLE_INPUT_DATA_ATTR } from './utils/titleInputDom';
import { registerCurrentTitleCommitter } from './utils/titleCommitRegistry';
import { isDraftNotePath, resolveDraftNoteTitle } from '@/stores/notes/draftNote';
import { isAbsolutePath } from '@/lib/storage/adapter';
import { logNotesDebug } from '@/stores/notes/debugLog';

interface TitleInputProps {
  notePath: string;
  initialTitle: string;
  onEnter?: () => void;
  autoFocus?: boolean;
}

export function TitleInput({ notePath, initialTitle, onEnter, autoFocus }: TitleInputProps) {
  const [title, setTitle] = useState(initialTitle);
  const inputRef = useRef<HTMLInputElement>(null);
  const skipNextBlurCommitRef = useRef(false);
  const isCommittingRef = useRef(false);
  const titleActionFrameRef = useRef<number | null>(null);
  const commitTitleRef = useRef<() => Promise<void>>(async () => undefined);
  const lastTitleDebugRef = useRef<string | null>(null);
  const renameNote = useNotesStore(s => s.renameNote);
  const renameAbsoluteNote = useNotesStore(s => s.renameAbsoluteNote);
  const updateDraftNoteName = useNotesStore(s => s.updateDraftNoteName);
  const saveNote = useNotesStore(s => s.saveNote);
  const setNotesPreviewTitle = useUIStore(s => s.setNotesPreviewTitle);
  const titleInputDataAttrs = { [NOTE_TITLE_INPUT_DATA_ATTR]: 'true' as const };

  useEffect(() => {
    const snapshot = JSON.stringify({
      notePath,
      isDraftNote: isDraftNotePath(notePath),
      initialTitle,
      localTitle: title,
      autoFocus: Boolean(autoFocus),
      isActiveElement: inputRef.current === document.activeElement,
    });
    if (lastTitleDebugRef.current !== snapshot) {
      lastTitleDebugRef.current = snapshot;
      logNotesDebug('notes:title-input:state', JSON.parse(snapshot));
    }
  }, [autoFocus, initialTitle, notePath, title]);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      logNotesDebug('notes:title-input:autofocus-scheduled', {
        notePath,
        initialTitle,
      });
      if (titleActionFrameRef.current !== null) {
        cancelAnimationFrame(titleActionFrameRef.current);
      }
      titleActionFrameRef.current = requestAnimationFrame(() => {
        titleActionFrameRef.current = null;
        if (inputRef.current) {
          inputRef.current.focus();
          const titleLength = inputRef.current.value.length;
          inputRef.current.setSelectionRange(titleLength, titleLength);
          logNotesDebug('notes:title-input:autofocus-applied', {
            notePath,
            activeElementTag: document.activeElement?.tagName ?? null,
            selectionStart: inputRef.current.selectionStart,
            selectionEnd: inputRef.current.selectionEnd,
          });
        }
      });
    }
  }, [autoFocus, initialTitle, notePath]);

  useEffect(() => {
    if (inputRef.current === document.activeElement || isCommittingRef.current) {
      return;
    }

    setTitle(initialTitle);
    logNotesDebug('notes:title-input:sync-initial-title', {
      notePath,
      initialTitle,
    });
  }, [initialTitle]);

  useEffect(() => {
    return () => {
      setNotesPreviewTitle(null, null);
    };
  }, [setNotesPreviewTitle]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    setTitle(newTitle);
    logNotesDebug('notes:title-input:change', {
      notePath,
      isDraftNote: isDraftNotePath(notePath),
      rawLength: newTitle.length,
      trimmedLength: newTitle.trim().length,
    });
    if (newTitle.trim()) {
      setNotesPreviewTitle(notePath, newTitle.trim());
    } else {
      setNotesPreviewTitle(null, null);
    }
  }, [notePath, setNotesPreviewTitle]);

  const commitTitleIfNeeded = useCallback(async () => {
    if (isCommittingRef.current) return;
    const trimmed = title.trim();
    if (!trimmed) {
      logNotesDebug('notes:title-input:commit-skipped', {
        reason: 'empty-title',
        notePath,
        initialTitle,
      });
      setTitle(initialTitle);
      setNotesPreviewTitle(null, null);
      return;
    }

    if (trimmed === initialTitle) {
      logNotesDebug('notes:title-input:commit-skipped', {
        reason: 'unchanged-title',
        notePath,
        title: trimmed,
      });
      setNotesPreviewTitle(null, null);
      return;
    }

    isCommittingRef.current = true;
    try {
      if (isDraftNotePath(notePath)) {
        logNotesDebug('notes:title-input:commit-draft-title', {
          notePath,
          title: trimmed,
          notesPath: useNotesStore.getState().notesPath,
        });
        updateDraftNoteName(notePath, trimmed);
        if (useNotesStore.getState().notesPath) {
          await saveNote({ explicit: false });
        }
        setTitle(resolveDraftNoteTitle(trimmed));
        return;
      }

      if (isAbsolutePath(notePath)) {
        logNotesDebug('notes:title-input:commit-absolute-rename', {
          notePath,
          title: trimmed,
        });
        await renameAbsoluteNote(notePath, trimmed);
      } else {
        logNotesDebug('notes:title-input:commit-rename', {
          notePath,
          title: trimmed,
        });
        await renameNote(notePath, trimmed);
      }
    } finally {
      isCommittingRef.current = false;
      setNotesPreviewTitle(null, null);
    }
  }, [title, initialTitle, notePath, renameAbsoluteNote, renameNote, saveNote, setNotesPreviewTitle, updateDraftNoteName]);

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

  const handleKeyDown = useCallback(async (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      await commitTitleIfNeeded();
      runAfterTitleCommit(() => {
        onEnter?.();
      });
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      await commitTitleIfNeeded();
      runAfterTitleCommit(() => {
        focusEditorToFirstLineStart();
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
    <input
      ref={inputRef}
      {...titleInputDataAttrs}
      type="text"
      spellCheck={false}
      value={title}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className="w-full bg-transparent border-none outline-none text-[42px] font-bold leading-[1.2] tracking-[-0.02em] text-[var(--vlaina-text-primary)] placeholder:text-[var(--vlaina-text-disabled)] selection:bg-[var(--vlaina-selection-bg)] selection:text-white"
      placeholder="Untitled"
    />
  );
}
