import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { isEditableTarget } from '../model/whiteboardInteractions';
import type { WhiteboardElement, WhiteboardPaperStyle, WhiteboardStroke } from '../model/whiteboardModel';

interface WhiteboardSnapshot {
  elements: WhiteboardElement[];
  paper: WhiteboardPaperStyle;
  strokes: WhiteboardStroke[];
}

interface WhiteboardHistoryOptions extends WhiteboardSnapshot {
  active: boolean;
  historyKey: string | null;
  setPaper: Dispatch<SetStateAction<WhiteboardPaperStyle>>;
  setElements: Dispatch<SetStateAction<WhiteboardElement[]>>;
  setStrokes: Dispatch<SetStateAction<WhiteboardStroke[]>>;
}

export function useWhiteboardHistory({
  active,
  elements,
  historyKey,
  paper,
  setElements,
  setPaper,
  setStrokes,
  strokes,
}: WhiteboardHistoryOptions) {
  const undoStackRef = useRef<WhiteboardSnapshot[]>([]);
  const redoStackRef = useRef<WhiteboardSnapshot[]>([]);
  const [version, setVersion] = useState(0);
  const historyKeyRef = useRef(historyKey);

  useEffect(() => {
    if (historyKeyRef.current === historyKey) return;
    historyKeyRef.current = historyKey;
    undoStackRef.current = [];
    redoStackRef.current = [];
    setVersion((current) => current + 1);
  }, [historyKey]);

  const getSnapshot = useCallback(() => ({
    elements: [...elements],
    paper,
    strokes: [...strokes],
  }), [elements, paper, strokes]);

  const applySnapshot = useCallback((snapshot: WhiteboardSnapshot) => {
    setElements(snapshot.elements);
    setPaper(snapshot.paper);
    setStrokes(snapshot.strokes);
  }, [setElements, setPaper, setStrokes]);

  const pushHistory = useCallback(() => {
    undoStackRef.current = [...undoStackRef.current.slice(-99), getSnapshot()];
    redoStackRef.current = [];
    setVersion((current) => current + 1);
  }, [getSnapshot]);

  const undo = useCallback(() => {
    const previous = undoStackRef.current.pop();
    if (!previous) return;
    redoStackRef.current.push(getSnapshot());
    applySnapshot(previous);
    setVersion((current) => current + 1);
  }, [applySnapshot, getSnapshot]);

  const redo = useCallback(() => {
    const next = redoStackRef.current.pop();
    if (!next) return;
    undoStackRef.current.push(getSnapshot());
    applySnapshot(next);
    setVersion((current) => current + 1);
  }, [applySnapshot, getSnapshot]);

  useEffect(() => {
    if (!active) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target) || (!event.ctrlKey && !event.metaKey)) return;
      const key = event.key.toLowerCase();
      if (key === 'z' && !event.shiftKey) {
        event.preventDefault();
        undo();
      } else if (key === 'y' || (key === 'z' && event.shiftKey)) {
        event.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [active, redo, undo]);

  return {
    canRedo: redoStackRef.current.length > 0,
    canUndo: undoStackRef.current.length > 0,
    pushHistory,
    redo,
    undo,
    version,
  };
}
