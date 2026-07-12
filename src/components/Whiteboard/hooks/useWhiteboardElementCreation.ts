import { useCallback, type Dispatch, type MutableRefObject, type RefObject, type SetStateAction } from 'react';
import {
  WHITEBOARD_DEFAULT_NOTE_COLOR,
  createWhiteboardElement,
  screenPointToBoardPoint,
  type WhiteboardElement,
  type WhiteboardNoteColor,
  type WhiteboardPoint,
  type WhiteboardTool,
  type WhiteboardViewport,
} from '../model/whiteboardModel';

interface WhiteboardElementCreationOptions {
  elementIdRef: MutableRefObject<number>;
  elements: WhiteboardElement[];
  pushHistory: () => void;
  selectedElementIds: string[];
  setElements: Dispatch<SetStateAction<WhiteboardElement[]>>;
  setSelectedConnectorIds: Dispatch<SetStateAction<string[]>>;
  setSelectedElementId: Dispatch<SetStateAction<string | null>>;
  setSelectedStrokeIds: Dispatch<SetStateAction<string[]>>;
  setTool: Dispatch<SetStateAction<WhiteboardTool>>;
  tool: WhiteboardTool;
  viewport: WhiteboardViewport;
  viewportRef: RefObject<HTMLDivElement | null>;
}

export function useWhiteboardElementCreation({
  elementIdRef,
  elements,
  pushHistory,
  selectedElementIds,
  setElements,
  setSelectedConnectorIds,
  setSelectedElementId,
  setSelectedStrokeIds,
  setTool,
  tool,
  viewport,
  viewportRef,
}: WhiteboardElementCreationOptions) {
  const commitCreatedElement = useCallback((element: WhiteboardElement) => {
    pushHistory();
    elementIdRef.current += 1;
    setElements((current) => [...current, element]);
    setSelectedConnectorIds([]);
    setSelectedElementId(element.id);
    setSelectedStrokeIds([]);
    setTool('select');
  }, [elementIdRef, pushHistory, setElements, setSelectedConnectorIds, setSelectedElementId, setSelectedStrokeIds, setTool]);

  const createElementAt = useCallback((
    type: 'note' | 'rect' | 'ellipse',
    point: WhiteboardPoint,
    text = '',
  ) => {
    const id = `wb-element-${elementIdRef.current}`;
    commitCreatedElement({ ...createWhiteboardElement(id, type, point), text });
  }, [commitCreatedElement, elementIdRef]);

  const createTextNote = useCallback((text: string) => {
    const rect = viewportRef.current?.getBoundingClientRect();
    const center = { x: (rect?.width ?? 0) / 2, y: (rect?.height ?? 0) / 2 };
    createElementAt('note', screenPointToBoardPoint(center, viewport), text);
  }, [createElementAt, viewport, viewportRef]);

  const selectedNote = selectedElementIds.length === 1
    ? elements.find((element) => (
      element.id === selectedElementIds[0] && element.type === 'note'
    )) ?? null
    : null;

  const setSelectedNoteColor = useCallback((noteColor: WhiteboardNoteColor) => {
    if (!selectedNote || selectedNote.noteColor === noteColor) return;
    pushHistory();
    setElements((current) => current.map((element) => (
      element.id === selectedNote.id ? { ...element, noteColor } : element
    )));
  }, [pushHistory, selectedNote, setElements]);

  return {
    commitCreatedElement,
    createElementAt,
    createTextNote,
    selectedNoteColor: tool === 'select' && selectedNote
      ? selectedNote.noteColor ?? WHITEBOARD_DEFAULT_NOTE_COLOR
      : null,
    setSelectedNoteColor,
  };
}
