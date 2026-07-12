import { act, renderHook } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { useWhiteboardHistory } from './useWhiteboardHistory';
import type { WhiteboardConnector, WhiteboardElement, WhiteboardPaperStyle, WhiteboardStroke } from '../model/whiteboardModel';

describe('useWhiteboardHistory', () => {
  it('clears undo and redo state when the active board changes', () => {
    const { result, rerender } = renderHook(({ historyKey }: { historyKey: string }) => useHistoryHarness(historyKey), {
      initialProps: { historyKey: 'board-a' },
    });

    act(() => result.current.history.pushHistory());
    expect(result.current.history.canUndo).toBe(true);

    rerender({ historyKey: 'board-b' });

    expect(result.current.history.canUndo).toBe(false);
    expect(result.current.history.canRedo).toBe(false);
  });

  it('restores paper style through undo', () => {
    const { result } = renderHook(() => useHistoryHarness('board-a'));

    act(() => {
      result.current.history.pushHistory();
      result.current.setPaper('ruled');
    });
    expect(result.current.paper).toBe('ruled');

    act(() => result.current.history.undo());
    expect(result.current.paper).toBe('dots');
  });
});

function useHistoryHarness(historyKey: string) {
  const [connectors, setConnectors] = useState<WhiteboardConnector[]>([]);
  const [elements, setElements] = useState<WhiteboardElement[]>([]);
  const [strokes, setStrokes] = useState<WhiteboardStroke[]>([]);
  const [paper, setPaper] = useState<WhiteboardPaperStyle>('dots');
  const history = useWhiteboardHistory({
    active: true,
    connectors,
    elements,
    historyKey,
    paper,
    setConnectors,
    setElements,
    setPaper,
    setStrokes,
    strokes,
  });
  return { history, paper, setPaper };
}
