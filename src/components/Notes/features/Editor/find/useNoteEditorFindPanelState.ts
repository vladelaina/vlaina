import { useCallback, useEffect, useRef, useState } from 'react';
import { EDITOR_FIND_OPEN_EVENT } from './editorFindEvents';

interface UseNoteEditorFindPanelStateOptions {
  notePath: string | null | undefined;
  hasQuery: boolean;
  onClose: (restoreFocus?: boolean) => void;
}

function focusInputElement(input: HTMLInputElement | null, selectAll: boolean) {
  if (!input) {
    return;
  }

  input.focus();
  if (selectAll) {
    input.select();
  }
}

export function useNoteEditorFindPanelState({
  notePath,
  hasQuery,
  onClose,
}: UseNoteEditorFindPanelStateOptions) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const replaceInputRef = useRef<HTMLInputElement | null>(null);
  const lastNotePathRef = useRef<string | null | undefined>(notePath);
  const [isOpen, setIsOpen] = useState(false);
  const [isReplaceOpen, setIsReplaceOpen] = useState(false);
  const [replaceValue, setReplaceValue] = useState('');
  const [focusToken, setFocusToken] = useState(0);

  const open = useCallback(() => {
    setIsOpen(true);
    setFocusToken((value) => value + 1);
  }, []);

  const close = useCallback(
    (restoreFocus = true) => {
      onClose(restoreFocus);
      setIsOpen(false);
      setIsReplaceOpen(false);
      setReplaceValue('');
    },
    [onClose],
  );

  const toggleReplace = useCallback(() => {
    if (!hasQuery) {
      return;
    }

    setIsReplaceOpen((value) => !value);
  }, [hasQuery]);

  useEffect(() => {
    const handleOpen = () => {
      open();
    };

    window.addEventListener(EDITOR_FIND_OPEN_EVENT, handleOpen);
    return () => window.removeEventListener(EDITOR_FIND_OPEN_EVENT, handleOpen);
  }, [open]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    requestAnimationFrame(() => {
      focusInputElement(inputRef.current, true);
    });
  }, [focusToken, isOpen]);

  useEffect(() => {
    if (!isReplaceOpen) {
      return;
    }

    requestAnimationFrame(() => {
      focusInputElement(replaceInputRef.current, false);
    });
  }, [isReplaceOpen]);

  useEffect(() => {
    if (hasQuery) {
      return;
    }

    setIsReplaceOpen(false);
  }, [hasQuery]);

  useEffect(() => {
    if (lastNotePathRef.current === notePath) {
      return;
    }

    lastNotePathRef.current = notePath;
    close(false);
  }, [close, notePath]);

  return {
    inputRef,
    replaceInputRef,
    isOpen,
    isReplaceOpen,
    replaceValue,
    setReplaceValue,
    open,
    close,
    toggleReplace,
  };
}
