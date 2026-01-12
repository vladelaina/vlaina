import { useState, useCallback, useRef, useEffect } from 'react';
import { useNotesStore } from '@/stores/useNotesStore';
import { useUIStore } from '@/stores/uiSlice';

interface TitleInputProps {
  notePath: string;
  initialTitle: string;
}

export function TitleInput({ notePath, initialTitle }: TitleInputProps) {
  const [title, setTitle] = useState(initialTitle);
  const inputRef = useRef<HTMLInputElement>(null);
  const renameNote = useNotesStore(s => s.renameNote);
  const setNotesPreviewTitle = useUIStore(s => s.setNotesPreviewTitle);

  // Sync with external changes
  useEffect(() => {
    setTitle(initialTitle);
  }, [initialTitle]);

  // Clear preview on unmount
  useEffect(() => {
    return () => {
      setNotesPreviewTitle(null, null);
    };
  }, [setNotesPreviewTitle]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value;
    setTitle(newTitle);
    // Real-time preview update
    if (newTitle.trim()) {
      setNotesPreviewTitle(notePath, newTitle.trim());
    } else {
      setNotesPreviewTitle(null, null);
    }
  }, [notePath, setNotesPreviewTitle]);

  const handleBlur = useCallback(async () => {
    const trimmed = title.trim();
    if (trimmed && trimmed !== initialTitle) {
      // First rename, then clear preview
      // This ensures displayName is updated before preview is cleared
      await renameNote(notePath, trimmed);
    } else {
      setTitle(initialTitle);
    }
    // Clear preview after rename is complete
    setNotesPreviewTitle(null, null);
  }, [title, initialTitle, notePath, renameNote, setNotesPreviewTitle]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      inputRef.current?.blur();
    } else if (e.key === 'Escape') {
      setTitle(initialTitle);
      setNotesPreviewTitle(null, null);
      inputRef.current?.blur();
    }
  }, [initialTitle, setNotesPreviewTitle]);

  return (
    <input
      ref={inputRef}
      type="text"
      value={title}
      onChange={handleChange}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className="w-full bg-transparent border-none outline-none text-[40px] font-bold leading-[1.2] tracking-[-0.02em] text-[var(--neko-text-primary)] placeholder:text-[var(--neko-text-disabled)] selection:bg-[#2783de] selection:text-white"
      placeholder="Untitled"
    />
  );
}
