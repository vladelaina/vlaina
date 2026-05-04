import { useCallback, useEffect, useRef, useSyncExternalStore, type KeyboardEventHandler } from 'react';
import {
  clearEditorFind,
  getEditorFindSnapshot,
  replaceAllEditorFindMatches,
  replaceCurrentEditorFindMatch,
  setEditorFindQuery,
  stepEditorFindMatch,
  subscribeEditorFindSnapshot,
} from '../plugins/find';
import { getCurrentEditorView } from '../utils/editorViewRegistry';
import type { NoteEditorFindController } from './types';
import { useNoteEditorFindPanelState } from './useNoteEditorFindPanelState';

export function useNoteEditorFind(
  notePath: string | null | undefined,
): NoteEditorFindController {
  const restoreFocusFrameRef = useRef<number | null>(null);
  const snapshot = useSyncExternalStore(
    subscribeEditorFindSnapshot,
    getEditorFindSnapshot,
    getEditorFindSnapshot,
  );

  const resolveView = useCallback(
    () => snapshot.view ?? getCurrentEditorView(),
    [snapshot.view],
  );

  const clearAndRestoreFocus = useCallback(
    (restoreFocus = true) => {
      const view = resolveView();
      if (view) {
        clearEditorFind(view);
      }

      if (restoreFocus) {
        if (restoreFocusFrameRef.current !== null) {
          cancelAnimationFrame(restoreFocusFrameRef.current);
        }

        restoreFocusFrameRef.current = requestAnimationFrame(() => {
          restoreFocusFrameRef.current = null;
          view?.focus();
        });
      }
    },
    [resolveView],
  );

  useEffect(() => () => {
    if (restoreFocusFrameRef.current !== null) {
      cancelAnimationFrame(restoreFocusFrameRef.current);
      restoreFocusFrameRef.current = null;
    }
  }, []);

  const panelState = useNoteEditorFindPanelState({
    notePath,
    hasQuery: snapshot.query.length > 0,
    onClose: clearAndRestoreFocus,
  });

  const setQuery = useCallback(
    (value: string) => {
      const view = resolveView();
      if (!view) {
        return;
      }

      setEditorFindQuery(view, value);
    },
    [resolveView],
  );

  const goToPrevious = useCallback(() => {
    const view = resolveView();
    if (!view) {
      return;
    }

    stepEditorFindMatch(view, -1);
  }, [resolveView]);

  const goToNext = useCallback(() => {
    const view = resolveView();
    if (!view) {
      return;
    }

    stepEditorFindMatch(view, 1);
  }, [resolveView]);

  const replaceCurrent = useCallback(() => {
    const view = resolveView();
    if (!view) {
      return;
    }

    replaceCurrentEditorFindMatch(view, panelState.replaceValue);
  }, [panelState.replaceValue, resolveView]);

  const replaceAll = useCallback(() => {
    const view = resolveView();
    if (!view) {
      return;
    }

    replaceAllEditorFindMatches(view, panelState.replaceValue);
  }, [panelState.replaceValue, resolveView]);

  const handleQueryKeyDown = useCallback<KeyboardEventHandler<HTMLInputElement>>(
    (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        panelState.close();
        return;
      }

      if (event.key === 'Enter') {
        event.preventDefault();
        if (event.shiftKey) {
          goToPrevious();
          return;
        }
        goToNext();
      }
    },
    [goToNext, goToPrevious, panelState],
  );

  const handleReplaceKeyDown = useCallback<KeyboardEventHandler<HTMLInputElement>>(
    (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        panelState.close();
        return;
      }

      if (event.key === 'Enter') {
        event.preventDefault();
        replaceCurrent();
      }
    },
    [panelState, replaceCurrent],
  );

  return {
    isOpen: panelState.isOpen,
    isReplaceOpen: panelState.isReplaceOpen,
    query: snapshot.query,
    replaceValue: panelState.replaceValue,
    activeMatchNumber: snapshot.activeIndex >= 0 ? snapshot.activeIndex + 1 : 0,
    totalMatches: snapshot.matches.length,
    canNavigate: snapshot.matches.length > 0,
    canReplace: snapshot.matches.length > 0,
    inputRef: panelState.inputRef,
    replaceInputRef: panelState.replaceInputRef,
    setQuery,
    setReplaceValue: panelState.setReplaceValue,
    open: panelState.open,
    close: panelState.close,
    goToPrevious,
    goToNext,
    toggleReplace: panelState.toggleReplace,
    replaceCurrent,
    replaceAll,
    handleQueryKeyDown,
    handleReplaceKeyDown,
  };
}
