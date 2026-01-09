import { useState, useCallback, useRef, useEffect } from 'react';
import { useNotesStore } from '@/stores/useNotesStore';

interface TitleInputProps {
  notePath: string;
  initialTitle: string;
}

export function TitleInput({ notePath, initialTitle }: TitleInputProps) {
  const [title, setTitle] = useState(initialTitle);
  const inputRef = useRef<HTMLInputElement>(null);
  const renameNote = useNotesStore(s => s.renameNote);

  // Sync with external changes
  useEffect(() => {
    setTitle(initialTitle);
  }, [initialTitle]);

  const handleBlur = useCallback(async () => {
    const trimmed = title.trim();
    if (trimmed && trimmed !== initialTitle) {
      await renameNote(notePath, trimmed);
    } else {
      setTitle(initialTitle);
    }
  }, [title, initialTitle, notePath, renameNote]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      inputRef.current?.blur();
    } else if (e.key === 'Escape') {
      setTitle(initialTitle);
    }
  }, [initialTitle]);

  return (
    <input
      ref={inputRef}
      type="text"
      value={title}
      onChange={(e) => setTitle(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className="w-full bg-transparent border-none outline-none text-[28px] font-bold leading-[calc(1em+8px)] tracking-[-0.02em] text-[var(--neko-text-primary)] placeholder:text-[var(--neko-text-disabled)]"
      placeholder="Untitled"
    />
  );
}
