import { useCallback, type RefObject } from 'react';
import {
  copyWhiteboardImageToClipboard,
  exportWhiteboard,
  type WhiteboardExportFormat,
} from '../model/whiteboardExport';
import type { WhiteboardConnector, WhiteboardElement, WhiteboardPaperStyle, WhiteboardStroke } from '../model/whiteboardModel';

interface WhiteboardExportOptions {
  connectors: WhiteboardConnector[];
  elements: WhiteboardElement[];
  paper: WhiteboardPaperStyle;
  strokes: WhiteboardStroke[];
  viewportRef: RefObject<HTMLDivElement | null>;
}

export function useWhiteboardExport({
  connectors,
  elements,
  paper,
  strokes,
  viewportRef,
}: WhiteboardExportOptions) {
  const exportBoard = useCallback((format: WhiteboardExportFormat = 'png') => {
    void exportWhiteboard({
      connectors,
      elements,
      paper,
      root: viewportRef.current,
      strokes,
    }, format);
  }, [connectors, elements, paper, strokes, viewportRef]);

  const copyBoardToClipboard = useCallback(() => {
    void copyWhiteboardImageToClipboard({
      connectors,
      elements,
      paper,
      root: viewportRef.current,
      strokes,
    });
  }, [connectors, elements, paper, strokes, viewportRef]);

  return { copyBoardToClipboard, exportBoard };
}
