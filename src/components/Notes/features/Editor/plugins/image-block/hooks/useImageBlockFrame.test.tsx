import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useImageBlockFrame } from './useImageBlockFrame';

class MockResizeObserver {
  static instances: MockResizeObserver[] = [];
  callback: ResizeObserverCallback;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    MockResizeObserver.instances.push(this);
  }

  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
}

function resize(width: number, height: number) {
  const observer = MockResizeObserver.instances.at(-1);
  expect(observer).toBeDefined();
  act(() => {
    observer!.callback(
      [{ contentRect: { width, height } } as ResizeObserverEntry],
      observer! as unknown as ResizeObserver,
    );
  });
}

describe('useImageBlockFrame', () => {
  const originalResizeObserver = globalThis.ResizeObserver;
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
    MockResizeObserver.instances = [];
    frameCallbacks = new Map();
    nextFrameId = 1;
    vi.stubGlobal('ResizeObserver', MockResizeObserver);
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
    vi.stubGlobal('ResizeObserver', originalResizeObserver);
    vi.stubGlobal('requestAnimationFrame', originalRequestAnimationFrame);
    vi.stubGlobal('cancelAnimationFrame', originalCancelAnimationFrame);
  });

  it('keeps the last usable size when active cropper layout briefly reports zero', () => {
    const { result, rerender } = renderHook(
      ({ isActive }) => useImageBlockFrame({
        height: undefined,
        isEditingCaption: false,
        isActive,
        isHoverDisabled: false,
        setIsHovered: vi.fn(),
      }),
      { initialProps: { isActive: false } },
    );

    const element = document.createElement('div');
    act(() => {
      result.current.containerRef.current = element;
    });

    rerender({ isActive: true });
    resize(347.75, 166.14);
    flushAnimationFrames();
    expect(result.current.finalContainerSize).toEqual({ width: 347.75, height: 166.14 });

    resize(0, 0);

    expect(result.current.finalContainerSize).toEqual({ width: 347.75, height: 166.14 });
  });

  it('coalesces rapid observed size changes into one frame commit', () => {
    const { result, rerender } = renderHook(
      ({ isActive }) => useImageBlockFrame({
        height: undefined,
        isEditingCaption: false,
        isActive,
        isHoverDisabled: false,
        setIsHovered: vi.fn(),
      }),
      { initialProps: { isActive: false } },
    );

    const element = document.createElement('div');
    act(() => {
      result.current.containerRef.current = element;
    });

    rerender({ isActive: true });
    resize(240, 120);
    resize(260, 140);
    resize(280, 160);

    expect(globalThis.requestAnimationFrame).toHaveBeenCalledTimes(1);
    expect(result.current.finalContainerSize).toEqual({ width: 0, height: 0 });

    flushAnimationFrames();

    expect(result.current.finalContainerSize).toEqual({ width: 280, height: 160 });
  });
});
