import { act, renderHook } from '@testing-library/react';
import type { PointerEvent } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { useWhiteboardPointerFinish } from './useWhiteboardPointerFinish';

describe('useWhiteboardPointerFinish', () => {
  it('cancels an erase gesture when the active pointer is cancelled', () => {
    const finishEraserGesture = vi.fn();
    const finishStrokeEraserGesture = vi.fn();
    const pushHistory = vi.fn();
    const { result } = renderHook(() => useWhiteboardPointerFinish({
      activePenPointerRef: { current: null as number | null }, clearDraftStroke: vi.fn(), deletePointer: vi.fn(), dragState: { kind: 'draw' }, elements: [],
      finishEraserGesture, finishStrokeEraserGesture, finishRulerDrag: vi.fn(), finishRulerStroke: vi.fn(), flushResizeDrags: vi.fn(),
      getBoardPoint: vi.fn(() => ({ x: 0, y: 0 })), getDraftStroke: vi.fn(() => null), moveOrResizeElement: vi.fn((element) => element), pushHistory,
      setDragState: vi.fn(), setElements: vi.fn(), setSelectedElementIds: vi.fn(), setSelectedStrokeIds: vi.fn(), setStrokes: vi.fn(),
      strokeIdRef: { current: 1 }, strokes: [],
    }));

    act(() => result.current({ pointerId: 7, type: 'pointercancel' } as PointerEvent<HTMLDivElement>));
    expect(finishEraserGesture).toHaveBeenCalledWith(true);
    expect(finishStrokeEraserGesture).toHaveBeenCalledWith(true);
    expect(pushHistory).not.toHaveBeenCalled();
  });
});
