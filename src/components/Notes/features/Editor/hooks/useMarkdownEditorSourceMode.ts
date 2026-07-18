import { useCallback, useEffect, useState, type RefObject } from 'react';
import { useNotesStore } from '@/stores/useNotesStore';
import { flushCurrentPendingEditorMarkdown } from '@/stores/notes/pendingEditorMarkdown';
import { themeEditorLayoutTokens } from '@/styles/themeTokens';
import { getCurrentEditorView } from '../utils/editorViewRegistry';
import { flushCurrentEditorSave } from '../utils/editorSaveRegistry';
import { NOTE_SOURCE_MODE_TOGGLE_EVENT } from '../sourceMode/sourceModeEvents';

export function useMarkdownEditorSourceMode({
  currentNotePath,
  hasActiveNote,
  onEditorViewReady,
  scrollRootRef,
}: {
  currentNotePath: string | undefined;
  hasActiveNote: boolean;
  onEditorViewReady?: () => void;
  scrollRootRef: RefObject<HTMLDivElement | null>;
}) {
  const [editorReadyTarget, setEditorReadyTarget] = useState<{
    path: string | undefined;
  } | null>(null);
  const [editorInitTimedOutPath, setEditorInitTimedOutPath] = useState<string | null>(null);
  const [isSourceMode, setIsSourceMode] = useState(false);
  const isEditorViewReady = editorReadyTarget?.path === currentNotePath;

  const handleEditorViewReady = useCallback(() => {
    setEditorInitTimedOutPath(null);
    setEditorReadyTarget({
      path: currentNotePath,
    });
    onEditorViewReady?.();
  }, [currentNotePath, onEditorViewReady]);

  const getCurrentNoteContent = useCallback(() => {
    if (!currentNotePath) {
      return '';
    }

    const state = useNotesStore.getState();
    const currentNote = state.currentNote;
    if (currentNote?.path === currentNotePath) {
      return currentNote.content;
    }

    return state.noteContentsCache.get(currentNotePath)?.content ?? '';
  }, [currentNotePath]);

  const handleToggleSourceMode = useCallback(() => {
    flushCurrentPendingEditorMarkdown();
    void flushCurrentEditorSave();
    setIsSourceMode((nextSourceMode) => !nextSourceMode);
  }, []);

  useEffect(() => {
    if (!hasActiveNote) {
      return;
    }

    window.addEventListener(NOTE_SOURCE_MODE_TOGGLE_EVENT, handleToggleSourceMode);
    return () => {
      window.removeEventListener(NOTE_SOURCE_MODE_TOGGLE_EVENT, handleToggleSourceMode);
    };
  }, [handleToggleSourceMode, hasActiveNote]);

  useEffect(() => {
    setEditorInitTimedOutPath(null);
    if (isSourceMode || !hasActiveNote || !currentNotePath || isEditorViewReady) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      const hasLiveEditor =
        Boolean(getCurrentEditorView()) ||
        Boolean(scrollRootRef.current?.querySelector('.milkdown .ProseMirror'));
      if (hasLiveEditor) {
        setEditorReadyTarget({
          path: currentNotePath,
        });
        onEditorViewReady?.();
        return;
      }

      setEditorInitTimedOutPath(currentNotePath);
      onEditorViewReady?.();
    }, themeEditorLayoutTokens.editorInitFallbackDelayMs);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [currentNotePath, hasActiveNote, isEditorViewReady, isSourceMode, onEditorViewReady, scrollRootRef]);

  useEffect(() => {
    if (isSourceMode && hasActiveNote) {
      handleEditorViewReady();
    }
  }, [handleEditorViewReady, hasActiveNote, isSourceMode]);

  return {
    getCurrentNoteContent,
    handleEditorViewReady,
    handleToggleSourceMode,
    isEditorViewReady,
    isSourceMode,
    shouldUseSourceFallback:
      !isSourceMode && hasActiveNote && currentNotePath !== undefined && editorInitTimedOutPath === currentNotePath,
  };
}
