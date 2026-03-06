import { useState, useCallback, useRef, useEffect } from 'react';
import { useNotesStore } from '@/stores/useNotesStore';
import { useUIStore } from '@/stores/uiSlice';
import { focusEditorToFirstLineStart } from './utils/focusEditor';
import { NOTE_TITLE_INPUT_DATA_ATTR } from './utils/titleInputDom';

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
  const renameNote = useNotesStore(s => s.renameNote);
  const setNotesPreviewTitle = useUIStore(s => s.setNotesPreviewTitle);
  const titleInputDataAttrs = { [NOTE_TITLE_INPUT_DATA_ATTR]: 'true' as const };

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      requestAnimationFrame(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.select();
        }
      });
    }
  }, [autoFocus]);

  // Sync with external changes
  useEffect(() => {
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
      await renameNote(notePath, trimmed);
    } finally {
      isCommittingRef.current = false;
      setNotesPreviewTitle(null, null);
    }
  }, [title, initialTitle, notePath, renameNote, setNotesPreviewTitle]);

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
    requestAnimationFrame(callback);
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
      isCommittingRef.current = false;
      skipNextBlurCommitRef.current = false;
    };
  }, []);

  return (
    <input
      ref={inputRef}
      {...titleInputDataAttrs}
      type="text"
      value={title}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className="w-full bg-transparent border-none outline-none text-[42px] font-bold leading-[1.2] tracking-[-0.02em] text-[var(--neko-text-primary)] placeholder:text-[var(--neko-text-disabled)] selection:bg-[#2783de] selection:text-white"
      placeholder="Untitled"
    />
  );
}
