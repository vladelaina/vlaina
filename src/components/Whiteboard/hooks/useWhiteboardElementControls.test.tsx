import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useWhiteboardElementControls } from './useWhiteboardElementControls';
import type { WhiteboardElement } from '../model/whiteboardModel';

describe('useWhiteboardElementControls', () => {
  it('resizes an image while preserving its aspect ratio', () => {
    const image: WhiteboardElement = { height: 80, id: 'image', text: '', type: 'image', width: 160, x: 20, y: 40 };
    const { result } = renderHook(() => useWhiteboardElementControls({
      elements: [image], getBoardPoint: vi.fn(), pushHistory: vi.fn(), selectedElementIds: ['image'], selectedStrokeIds: [],
      setDragState: vi.fn(), setElements: vi.fn(), setSelectedElementIds: vi.fn(), setSelectedStrokeIds: vi.fn(), setStrokes: vi.fn(), strokes: [], tool: 'select',
    }));

    const resized = result.current.moveOrResizeElement(image, {
      aspectRatio: 2, id: 'image', kind: 'resize', preserveAspectRatio: true,
      startHeight: 80, startPoint: { x: 0, y: 0 }, startWidth: 160,
    }, { x: 40, y: 0 });

    expect(resized).toMatchObject({ height: 100, width: 200 });
  });
});
