import { act, renderHook } from '@testing-library/react';
import type { PointerEvent } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { useWhiteboardStrokeSelection } from './useWhiteboardStrokeSelection';

describe('useWhiteboardStrokeSelection', () => {
  it('moves the full mixed selection when dragging an already selected stroke', () => {
    const element = { height: 80, id: 'image-1', text: 'one.png', type: 'image' as const, width: 100, x: 0, y: 0 };
    const stroke = {
      color: '#111111', id: 'stroke-1',
      points: [{ pressure: 0.5, x: 120, y: 0 }, { pressure: 0.5, x: 140, y: 20 }],
      size: 1, tool: 'pen' as const,
    };
    const setDragState = vi.fn();
    const setSelectedElementId = vi.fn();
    const { result } = renderHook(() => useWhiteboardStrokeSelection({
      elements: [element], pushHistory: vi.fn(), selectedElementIds: [element.id], selectedStrokeIds: [stroke.id],
      setDragState, setSelectedElementId, setSelectedStrokeIds: vi.fn(), strokes: [stroke], zoom: 1,
    }));

    act(() => result.current({ x: 130, y: 10 }, { shiftKey: false } as PointerEvent<HTMLDivElement>));

    expect(setSelectedElementId).not.toHaveBeenCalled();
    expect(setDragState).toHaveBeenCalledWith(expect.objectContaining({
      elementIds: [element.id], kind: 'move-elements', strokeIds: [stroke.id],
    }));
  });
});
