import { NoteEditorFindBar } from './find/NoteEditorFindBar';
import type { NoteEditorFindController } from './find/types';
import { NoteToolbarActions } from './NoteToolbarActions';

export interface EditorTopRightToolbarProps {
  editorFind: NoteEditorFindController;
  currentNotePath: string | null | undefined;
  currentNoteTitle: string;
  getCurrentNoteContent: () => string;
  isSourceMode?: boolean;
  onToggleSourceMode?: () => void;
  notesPath: string;
  starred: boolean;
  toggleStarred: (path: string) => void;
  currentNoteMetadata:
    | {
        createdAt?: string | number | Date | null;
        updatedAt?: string | number | Date | null;
      }
    | undefined;
  showNoteActions?: boolean;
}

export function EditorTopRightToolbar({
  editorFind,
  currentNotePath,
  currentNoteTitle,
  getCurrentNoteContent,
  isSourceMode = false,
  onToggleSourceMode,
  notesPath,
  starred,
  toggleStarred,
  currentNoteMetadata,
  showNoteActions = true,
}: EditorTopRightToolbarProps) {
  return (
    <div
      className="absolute top-0 right-3 z-[var(--vlaina-z-30)] flex translate-x-[var(--vlaina-window-resize-compensation-x)] items-start gap-2"
      data-no-editor-drag-box="true"
    >
      <NoteEditorFindBar controller={editorFind} />

      {!editorFind.isOpen && showNoteActions ? (
        <NoteToolbarActions
          currentNotePath={currentNotePath}
          currentNoteTitle={currentNoteTitle}
          getCurrentNoteContent={getCurrentNoteContent}
          isSourceMode={isSourceMode}
          onToggleSourceMode={onToggleSourceMode}
          notesPath={notesPath}
          starred={starred}
          toggleStarred={toggleStarred}
          currentNoteMetadata={currentNoteMetadata}
        />
      ) : null}
    </div>
  );
}
