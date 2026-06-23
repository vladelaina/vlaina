import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LONG_PRESS_DELAY_MS } from './imageDragSession';
import { useImageDrag } from './useImageDrag';

const mocks = vi.hoisted(() => ({
  setDragState: vi.fn(),
  clearDragState: vi.fn(),
  moveImageNode: vi.fn(),
  calculateAlignmentFromPosition: vi.fn(() => 'right'),
  calculateDropPosition: vi.fn((_view: unknown, clientY: number) => clientY),
  startPreview: vi.fn(),
  updatePreviewPosition: vi.fn(),
  setPreviewAlignment: vi.fn(),
  resetPreview: vi.fn(),
}));

vi.mock('../imageDragPlugin', () => ({
  setDragState: mocks.setDragState,
  clearDragState: mocks.clearDragState,
}));

vi.mock('../commands/imageNodeCommands', () => ({
  moveImageNode: mocks.moveImageNode,
}));

vi.mock('../utils/imageDropPosition', () => ({
  calculateAlignmentFromPosition: mocks.calculateAlignmentFromPosition,
  calculateDropPosition: mocks.calculateDropPosition,
}));

vi.mock('./useImageDragPreview', () => ({
  useImageDragPreview: () => ({
    isDragging: false,
    dragPosition: null,
    dragSize: null,
    dragAlignment: 'center',
    startPreview: mocks.startPreview,
    updatePreviewPosition: mocks.updatePreviewPosition,
    setPreviewAlignment: mocks.setPreviewAlignment,
    resetPreview: mocks.resetPreview,
  }),
}));

function createContainer() {
  const container = document.createElement('div');
  Object.defineProperty(container, 'offsetWidth', { configurable: true, value: 320 });
  Object.defineProperty(container, 'offsetHeight', { configurable: true, value: 180 });
  container.getBoundingClientRect = () => ({
    x: 10,
    y: 20,
    left: 10,
    top: 20,
    right: 330,
    bottom: 200,
    width: 320,
    height: 180,
    toJSON: () => ({}),
  });
  return container;
}

function createPointerDownEvent(target: HTMLElement) {
  return {
    isPrimary: true,
    button: 0,
    target,
    clientX: 40,
    clientY: 50,
    ctrlKey: false,
    metaKey: false,
    preventDefault: vi.fn(),
  } as unknown as React.PointerEvent;
}

function dispatchPointerMove(clientX: number, clientY: number) {
  window.dispatchEvent(new MouseEvent('pointermove', {
    bubbles: true,
    clientX,
    clientY,
  }));
}

describe('useImageDrag', () => {
  const originalRequestAnimationFrame = globalThis.requestAnimationFrame;
  const originalCancelAnimationFrame = globalThis.cancelAnimationFrame;
  let frameCallbacks: Map<number, FrameRequestCallback>;
  let nextFrameId: number;

  const flushAnimationFrames = () => {
    const callbacks = Array.from(frameCallbacks.values());
    frameCallbacks.clear();
    act(() => {
      callbacks.forEach((callback) => callback(16));
    });
  };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    frameCallbacks = new Map();
    nextFrameId = 1;
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
      const id = nextFrameId;
      nextFrameId += 1;
      frameCallbacks.set(id, callback);
      return id;
    }));
    vi.stubGlobal('cancelAnimationFrame', vi.fn((id: number) => {
      frameCallbacks.delete(id);
    }));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.stubGlobal('requestAnimationFrame', originalRequestAnimationFrame);
    vi.stubGlobal('cancelAnimationFrame', originalCancelAnimationFrame);
  });

  it('coalesces drag pointer movement per animation frame and flushes the final point before committing', () => {
    const container = createContainer();
    const view = {
      dom: document.createElement('div'),
    };
    const containerRef = { current: container };
    const { result } = renderHook(() => useImageDrag({
      view: view as never,
      getPos: () => 5,
      containerRef,
      isActive: false,
      loadError: false,
      currentAlignment: 'center',
    }));

    act(() => {
      result.current.handlePointerDown(createPointerDownEvent(container));
    });
    act(() => {
      vi.advanceTimersByTime(LONG_PRESS_DELAY_MS);
    });

    expect(mocks.startPreview).toHaveBeenCalledTimes(1);

    act(() => {
      dispatchPointerMove(60, 70);
      dispatchPointerMove(80, 90);
      dispatchPointerMove(100, 110);
    });

    expect(globalThis.requestAnimationFrame).toHaveBeenCalledTimes(1);
    expect(mocks.updatePreviewPosition).not.toHaveBeenCalled();

    flushAnimationFrames();

    expect(mocks.updatePreviewPosition).toHaveBeenCalledTimes(1);
    expect(mocks.updatePreviewPosition.mock.calls[0]![1]).toBe(100);
    expect(mocks.updatePreviewPosition.mock.calls[0]![2]).toBe(110);
    expect(mocks.calculateDropPosition).toHaveBeenLastCalledWith(view, 110, 5);

    act(() => {
      dispatchPointerMove(120, 130);
      dispatchPointerMove(140, 150);
    });

    expect(globalThis.requestAnimationFrame).toHaveBeenCalledTimes(2);
    expect(mocks.updatePreviewPosition).toHaveBeenCalledTimes(1);

    act(() => {
      window.dispatchEvent(new MouseEvent('pointerup', { bubbles: true }));
    });

    expect(mocks.updatePreviewPosition).toHaveBeenCalledTimes(2);
    expect(mocks.updatePreviewPosition.mock.calls[1]![1]).toBe(140);
    expect(mocks.updatePreviewPosition.mock.calls[1]![2]).toBe(150);
    expect(mocks.moveImageNode).toHaveBeenCalledWith(view, {
      sourcePos: 5,
      targetPos: 150,
      alignment: 'right',
    });
    expect(frameCallbacks.size).toBe(0);
  });
});
