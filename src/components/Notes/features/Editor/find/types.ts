import type { KeyboardEventHandler, RefObject } from 'react';

export interface NoteEditorFindController {
  isOpen: boolean;
  isReplaceOpen: boolean;
  query: string;
  replaceValue: string;
  activeMatchNumber: number;
  totalMatches: number;
  canNavigate: boolean;
  canReplace: boolean;
  inputRef: RefObject<HTMLInputElement | null>;
  replaceInputRef: RefObject<HTMLInputElement | null>;
  setQuery: (value: string) => void;
  setReplaceValue: (value: string) => void;
  open: () => void;
  close: (restoreFocus?: boolean) => void;
  goToPrevious: () => void;
  goToNext: () => void;
  toggleReplace: () => void;
  replaceCurrent: () => void;
  replaceAll: () => void;
  handleQueryKeyDown: KeyboardEventHandler<HTMLInputElement>;
  handleReplaceKeyDown: KeyboardEventHandler<HTMLInputElement>;
}
