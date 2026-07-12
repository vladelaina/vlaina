import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from 'react';
import { isImageFileLike } from '@/lib/assets/core/naming';
import { writeTextToClipboard } from '@/lib/clipboard';
import { isEditableTarget } from '../model/whiteboardInteractions';
import type { WhiteboardConnector, WhiteboardElement, WhiteboardStroke, WhiteboardTool } from '../model/whiteboardModel';
import { cloneConnectorsForElements, cloneElements, cloneStrokes } from '../model/whiteboardTransform';

interface WhiteboardClipboardPayload {
  connectors: WhiteboardConnector[];
  elements: WhiteboardElement[];
  strokes: WhiteboardStroke[];
}

interface WhiteboardClipboardOptions {
  active: boolean;
  connectors: WhiteboardConnector[];
  createTextNote: (text: string) => void;
  elements: WhiteboardElement[];
  importImage: (file: File) => void;
  pushHistory: () => void;
  selectedElementIds: string[];
  selectedStrokeIds: string[];
  setConnectors: Dispatch<SetStateAction<WhiteboardConnector[]>>;
  setElements: Dispatch<SetStateAction<WhiteboardElement[]>>;
  setSelectedElementIds: Dispatch<SetStateAction<string[]>>;
  setSelectedStrokeIds: Dispatch<SetStateAction<string[]>>;
  setStrokes: Dispatch<SetStateAction<WhiteboardStroke[]>>;
  setTool: Dispatch<SetStateAction<WhiteboardTool>>;
  strokes: WhiteboardStroke[];
}

export function useWhiteboardClipboard({
  active,
  connectors,
  createTextNote,
  elements,
  importImage,
  pushHistory,
  selectedElementIds,
  selectedStrokeIds,
  setConnectors,
  setElements,
  setSelectedElementIds,
  setSelectedStrokeIds,
  setStrokes,
  setTool,
  strokes,
}: WhiteboardClipboardOptions) {
  const clipboardRef = useRef<WhiteboardClipboardPayload | null>(null);
  const pasteCountRef = useRef(0);

  const copySelection = useCallback(() => {
    const selectedElementIdSet = new Set(selectedElementIds);
    const selectedElements = elements.filter((element) => selectedElementIdSet.has(element.id));
    const selectedIds = new Set(selectedStrokeIds);
    const selectedStrokes = strokes.filter((stroke) => selectedIds.has(stroke.id));
    if (selectedElements.length === 0 && selectedStrokes.length === 0) return false;
    const selectedElementIdSetForConnectors = new Set(selectedElements.map((element) => element.id));
    clipboardRef.current = {
      connectors: connectors.filter((connector) => selectedElementIdSetForConnectors.has(connector.fromId) && selectedElementIdSetForConnectors.has(connector.toId)),
      elements: selectedElements,
      strokes: selectedStrokes,
    };
    const copiedText = selectedElements.map((element) => element.text.trim()).filter(Boolean).join('\n\n');
    if (copiedText) void writeTextToClipboard(copiedText);
    return true;
  }, [connectors, elements, selectedElementIds, selectedStrokeIds, strokes]);

  const pasteSelection = useCallback(() => {
    const payload = clipboardRef.current;
    if (!payload) return;
    pasteCountRef.current += 1;
    const idPrefix = `wb-paste-${Date.now()}-${pasteCountRef.current}`;
    const offset = 28 * pasteCountRef.current;
    const nextElements = cloneElements(payload.elements, offset, idPrefix);
    const nextStrokes = cloneStrokes(payload.strokes, offset, idPrefix);
    const nextConnectors = cloneConnectorsForElements(payload.connectors, payload.elements, nextElements, idPrefix);
    pushHistory();
    setElements((current) => [...current, ...nextElements]);
    setStrokes((current) => [...current, ...nextStrokes]);
    setConnectors((current) => [...current, ...nextConnectors]);
    setSelectedElementIds(nextElements.map((element) => element.id));
    setSelectedStrokeIds(nextElements.length > 0 ? [] : nextStrokes.map((stroke) => stroke.id));
    setTool('select');
  }, [pushHistory, setConnectors, setElements, setSelectedElementIds, setSelectedStrokeIds, setStrokes, setTool]);

  const duplicateSelection = useCallback(() => {
    if (copySelection()) pasteSelection();
  }, [copySelection, pasteSelection]);

  useEffect(() => {
    if (!active) return undefined;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target) || (!event.ctrlKey && !event.metaKey)) return;
      const key = event.key.toLowerCase();
      if (key === 'c') {
        copySelection();
      } else if (key === 'v') {
        if (!clipboardRef.current) return;
        event.preventDefault();
        pasteSelection();
      } else if (key === 'd') {
        event.preventDefault();
        duplicateSelection();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [active, copySelection, duplicateSelection, pasteSelection]);

  useEffect(() => {
    if (!active) return undefined;
    const handlePaste = (event: ClipboardEvent) => {
      if (isEditableTarget(event.target)) return;
      const imageFile = Array.from(event.clipboardData?.files ?? []).find(isImageFileLike);
      if (imageFile) {
        event.preventDefault();
        importImage(imageFile);
        return;
      }
      if (clipboardRef.current) return;
      const text = event.clipboardData?.getData('text/plain').trim();
      if (!text) return;
      event.preventDefault();
      createTextNote(text);
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [active, createTextNote, importImage]);

  return { copySelection, duplicateSelection, pasteSelection };
}
