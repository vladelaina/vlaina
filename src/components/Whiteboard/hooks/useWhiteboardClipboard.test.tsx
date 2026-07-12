import { fireEvent, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useWhiteboardClipboard } from './useWhiteboardClipboard';

const mocks = vi.hoisted(() => ({
  writeTextToClipboard: vi.fn(async () => true),
}));

vi.mock('@/lib/clipboard', () => ({
  writeTextToClipboard: mocks.writeTextToClipboard,
}));

function createOptions(
  overrides: Partial<Parameters<typeof useWhiteboardClipboard>[0]> = {},
): Parameters<typeof useWhiteboardClipboard>[0] {
  return {
    active: true,
    connectors: [],
    createTextNote: vi.fn(),
    elements: [],
    importImage: vi.fn(),
    pushHistory: vi.fn(),
    selectedElementIds: [],
    selectedStrokeIds: [],
    setConnectors: vi.fn(),
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
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('copies selected note text to the system clipboard', () => {
    const options = createOptions({
      elements: [{ id: 'note-1', type: 'note', x: 0, y: 0, width: 220, height: 148, text: 'Project notes' }],
      selectedElementIds: ['note-1'],
    });
    const { result } = renderHook(() => useWhiteboardClipboard(options));

    expect(result.current.copySelection()).toBe(true);
    expect(mocks.writeTextToClipboard).toHaveBeenCalledWith('Project notes');
  });

  it('creates a note when plain text is pasted onto the canvas', () => {
    const createTextNote = vi.fn();
    renderHook(() => useWhiteboardClipboard(createOptions({ createTextNote })));
    const event = new Event('paste', { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'clipboardData', {
      value: {
        files: [],
        getData: (type: string) => type === 'text/plain' ? 'Pasted note' : '',
      },
    });

    fireEvent(window, event);

    expect(event.defaultPrevented).toBe(true);
    expect(createTextNote).toHaveBeenCalledWith('Pasted note');
  });
});
