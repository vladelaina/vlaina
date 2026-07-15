import type { PointerEvent } from 'react';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useWhiteboardElementControls } from './useWhiteboardElementControls';

describe('useWhiteboardElementControls', () => {
  it('selects one image and clears the stroke selection', () => {
    const setSelectedElementIds = vi.fn();
    const setSelectedStrokeIds = vi.fn();
    const { result } = renderHook(() => useWhiteboardElementControls({
      elements: [], getBoardPoint: vi.fn(), pushHistory: vi.fn(), selectedElementIds: [], selectedStrokeIds: ['stroke'],
      setDragState: vi.fn(), setElements: vi.fn(), setSelectedElementIds, setSelectedStrokeIds, setStrokes: vi.fn(), strokes: [], tool: 'select',
    }));

    act(() => result.current.selectElement('image'));

    expect(setSelectedElementIds).toHaveBeenCalledWith(['image']);
    expect(setSelectedStrokeIds).toHaveBeenCalledWith([]);
  });

  it('lets non-selection tools pass image input through to the canvas', () => {
    const stopPropagation = vi.fn();
    const { result } = renderHook(() => useWhiteboardElementControls({
      elements: [], getBoardPoint: vi.fn(), pushHistory: vi.fn(), selectedElementIds: [], selectedStrokeIds: [],
      setDragState: vi.fn(), setElements: vi.fn(), setSelectedElementIds: vi.fn(), setSelectedStrokeIds: vi.fn(), setStrokes: vi.fn(), strokes: [], tool: 'pen',
    }));

    act(() => result.current.handleElementPointerDown({ button: 0, stopPropagation } as unknown as PointerEvent<HTMLDivElement>, {
      height: 80, id: 'image', text: '', type: 'image', width: 160, x: 20, y: 40,
    }));

    expect(stopPropagation).not.toHaveBeenCalled();
  });
});
