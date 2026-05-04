import { useState, useCallback, useRef, useEffect } from 'react';
import { useNotesStore } from '@/stores/useNotesStore';
import { useUIStore } from '@/stores/uiSlice';
import { focusEditorToFirstLineStart } from './utils/focusEditor';
import { NOTE_TITLE_INPUT_DATA_ATTR } from './utils/titleInputDom';
import { registerCurrentTitleCommitter } from './utils/titleCommitRegistry';
import { isDraftNotePath, resolveDraftNoteTitle } from '@/stores/notes/draftNote';
import { isAbsolutePath } from '@/lib/storage/adapter';

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
  const renameNote = useNotesStore(s => s.renameNote);
  const renameAbsoluteNote = useNotesStore(s => s.renameAbsoluteNote);
  const updateDraftNoteName = useNotesStore(s => s.updateDraftNoteName);
  const setNotesPreviewTitle = useUIStore(s => s.setNotesPreviewTitle);
  const titleInputDataAttrs = { [NOTE_TITLE_INPUT_DATA_ATTR]: 'true' as const };

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      if (titleActionFrameRef.current !== null) {
        cancelAnimationFrame(titleActionFrameRef.current);
      }
      titleActionFrameRef.current = requestAnimationFrame(() => {
        titleActionFrameRef.current = null;
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      });
    }
  }, [autoFocus]);

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

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    setTitle(newTitle);
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
      setTitle(initialTitle);
      setNotesPreviewTitle(null, null);
      return;
    }

    if (trimmed === initialTitle) {
      setNotesPreviewTitle(null, null);
      return;
    }

    isCommittingRef.current = true;
    try {
      if (isDraftNotePath(notePath)) {
        updateDraftNoteName(notePath, trimmed);
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
  }, [title, initialTitle, notePath, renameAbsoluteNote, renameNote, setNotesPreviewTitle, updateDraftNoteName]);

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
