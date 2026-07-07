import { useCallback, type RefObject } from 'react';
import { exportWhiteboardPng } from '../model/whiteboardExport';
import type { WhiteboardConnector, WhiteboardElement, WhiteboardStroke } from '../model/whiteboardModel';

interface WhiteboardExportOptions {
  connectors: WhiteboardConnector[];
  elements: WhiteboardElement[];
  strokes: WhiteboardStroke[];
  viewportRef: RefObject<HTMLDivElement | null>;
}

export function useWhiteboardExport({
  connectors,
  elements,
  strokes,
  viewportRef,
}: WhiteboardExportOptions) {
  return useCallback(() => {
    void exportWhiteboardPng({
      connectors,
      elements,
      root: viewportRef.current,
      strokes,
    });
  }, [connectors, elements, strokes, viewportRef]);
}
