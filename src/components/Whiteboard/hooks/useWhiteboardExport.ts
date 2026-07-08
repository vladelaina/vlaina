import { useCallback, type RefObject } from 'react';
import {
  copyWhiteboardImageToClipboard,
  exportWhiteboard,
  type WhiteboardExportFormat,
} from '../model/whiteboardExport';
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
  const exportBoard = useCallback((format: WhiteboardExportFormat = 'png') => {
    void exportWhiteboard({
      connectors,
      elements,
      root: viewportRef.current,
      strokes,
    }, format);
  }, [connectors, elements, strokes, viewportRef]);

  const copyBoardToClipboard = useCallback(() => {
    void copyWhiteboardImageToClipboard({
      connectors,
      elements,
      root: viewportRef.current,
      strokes,
    });
  }, [connectors, elements, strokes, viewportRef]);

  return { copyBoardToClipboard, exportBoard };
}
