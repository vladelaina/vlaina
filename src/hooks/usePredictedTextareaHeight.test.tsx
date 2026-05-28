import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRef } from 'react';
import { usePredictedTextareaHeight } from './usePredictedTextareaHeight';

const textLayoutMocks = vi.hoisted(() => ({
  measureTextareaContentHeight: vi.fn(() => 48),
  resolveElementTextLayoutMetrics: vi.fn(() => ({
    font: '400 15px Inter',
    fontSize: 15,
    lineHeight: 24,
    paddingBlock: 12,
  })),
}));

vi.mock('@/lib/text-layout', () => ({
  measureTextareaContentHeight: () =>
    textLayoutMocks.measureTextareaContentHeight(),
  resolveElementTextLayoutMetrics: () =>
    textLayoutMocks.resolveElementTextLayoutMetrics(),
}));

class ResizeObserverMock {
  static instances: ResizeObserverMock[] = [];

  callback: ResizeObserverCallback;
  observe = vi.fn();
  disconnect = vi.fn();

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    ResizeObserverMock.instances.push(this);
  }
}

function Harness({ value }: { value: string }) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  usePredictedTextareaHeight(textareaRef, {
    value,
    minHeight: 24,
    maxHeight: 320,
  });

  return <textarea ref={textareaRef} />;
}

describe('usePredictedTextareaHeight', () => {
  beforeEach(() => {
    vi.useRealTimers();
    ResizeObserverMock.instances = [];
    textLayoutMocks.measureTextareaContentHeight.mockClear();
    textLayoutMocks.resolveElementTextLayoutMetrics.mockClear();
    vi.stubGlobal('ResizeObserver', ResizeObserverMock);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reuses a single ResizeObserver across value updates', () => {
    const view = render(<Harness value="first" />);
    const textarea = view.container.querySelector('textarea');
    expect(textarea).not.toBeNull();

    Object.defineProperty(textarea!, 'clientWidth', {
      configurable: true,
      get: () => 320,
    });

    view.rerender(<Harness value="second" />);
    view.rerender(<Harness value="third" />);

    expect(ResizeObserverMock.instances).toHaveLength(1);
    expect(ResizeObserverMock.instances[0]!.observe).toHaveBeenCalledTimes(1);
    expect(textLayoutMocks.measureTextareaContentHeight).toHaveBeenCalledTimes(2);

    view.unmount();

    expect(ResizeObserverMock.instances[0]!.disconnect).toHaveBeenCalledTimes(1);
  });

  it('does not lock fallback height while the textarea has no layout width', () => {
    vi.useFakeTimers();
    let width = 0;
    const originalClientWidth = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'clientWidth');
    Object.defineProperty(HTMLTextAreaElement.prototype, 'clientWidth', {
      configurable: true,
      get: () => width,
    });

    try {
      const view = render(<Harness value="first" />);
      const textarea = view.container.querySelector('textarea');
      expect(textarea).not.toBeNull();
      expect(textarea!.style.height).toBe('');
      expect(textLayoutMocks.measureTextareaContentHeight).not.toHaveBeenCalled();

      width = 320;
      act(() => {
        vi.advanceTimersByTime(120);
      });

      expect(textarea!.style.height).toBe('60px');
      expect(textLayoutMocks.measureTextareaContentHeight).toHaveBeenCalledTimes(1);
    } finally {
      if (originalClientWidth) {
        Object.defineProperty(HTMLTextAreaElement.prototype, 'clientWidth', originalClientWidth);
      } else {
        delete (HTMLTextAreaElement.prototype as { clientWidth?: number }).clientWidth;
      }
    }
  });

  it('ignores ResizeObserver callbacks caused by its own stable height write', () => {
    const originalClientWidth = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'clientWidth');
    Object.defineProperty(HTMLTextAreaElement.prototype, 'clientWidth', {
      configurable: true,
      get: () => 320,
    });

    try {
      const view = render(<Harness value="borderline wrap" />);
      const textarea = view.container.querySelector('textarea');
      expect(textarea).not.toBeNull();
      expect(textarea!.style.height).toBe('60px');
      expect(textLayoutMocks.measureTextareaContentHeight).toHaveBeenCalledTimes(1);

      act(() => {
        ResizeObserverMock.instances[0]!.callback([], ResizeObserverMock.instances[0] as unknown as ResizeObserver);
      });

      expect(textLayoutMocks.measureTextareaContentHeight).toHaveBeenCalledTimes(1);
      expect(textarea!.style.height).toBe('60px');
    } finally {
      if (originalClientWidth) {
        Object.defineProperty(HTMLTextAreaElement.prototype, 'clientWidth', originalClientWidth);
      } else {
        delete (HTMLTextAreaElement.prototype as { clientWidth?: number }).clientWidth;
      }
    }
  });
});
