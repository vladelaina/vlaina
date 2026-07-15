import { fireEvent, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useWhiteboardClipboard } from './useWhiteboardClipboard';

function createOptions(overrides: Partial<Parameters<typeof useWhiteboardClipboard>[0]> = {}) {
  return {
    active: true,
    elements: [],
    importImage: vi.fn(),
    pushHistory: vi.fn(),
    selectedElementIds: [],
    selectedStrokeIds: [],
    setElements: vi.fn(),
    setSelectedElementIds: vi.fn(),
    setSelectedStrokeIds: vi.fn(),
    setStrokes: vi.fn(),
    setTool: vi.fn(),
    strokes: [],
    ...overrides,
  };
}

describe('useWhiteboardClipboard', () => {
  it('duplicates selected images and strokes', () => {
    const setSelectedElementIds = vi.fn();
    const setSelectedStrokeIds = vi.fn();
    const options = createOptions({
      elements: [{ height: 80, id: 'image-1', text: 'demo.png', type: 'image', width: 100, x: 0, y: 0 }],
      selectedElementIds: ['image-1'],
      selectedStrokeIds: ['stroke-1'],
      setSelectedElementIds,
      setSelectedStrokeIds,
      strokes: [{ color: '#111111', id: 'stroke-1', points: [{ pressure: 0.5, x: 0, y: 0 }], size: 2, tool: 'pen' }],
    });
    const { result } = renderHook(() => useWhiteboardClipboard(options));
    result.current.duplicateSelection();
    expect(setSelectedElementIds.mock.calls[0][0]).toHaveLength(1);
    expect(setSelectedStrokeIds.mock.calls[0][0]).toHaveLength(1);
  });

  it('ignores plain text pasted onto the canvas', () => {
    renderHook(() => useWhiteboardClipboard(createOptions()));
    const event = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'clipboardData', { value: { files: [], getData: () => 'text' } });
    fireEvent(window, event);
    expect(event.defaultPrevented).toBe(false);
  });
});
