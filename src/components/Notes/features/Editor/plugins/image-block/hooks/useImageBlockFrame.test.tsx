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

  beforeEach(() => {
    MockResizeObserver.instances = [];
    vi.stubGlobal('ResizeObserver', MockResizeObserver);
  });

  afterEach(() => {
    vi.stubGlobal('ResizeObserver', originalResizeObserver);
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
    expect(result.current.finalContainerSize).toEqual({ width: 347.75, height: 166.14 });

    resize(0, 0);

    expect(result.current.finalContainerSize).toEqual({ width: 347.75, height: 166.14 });
  });
});
