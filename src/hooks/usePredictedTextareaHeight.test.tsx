import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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

  observe = vi.fn();
  disconnect = vi.fn();

  constructor(_callback: ResizeObserverCallback) {
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
    ResizeObserverMock.instances = [];
    textLayoutMocks.measureTextareaContentHeight.mockClear();
    textLayoutMocks.resolveElementTextLayoutMetrics.mockClear();
    vi.stubGlobal('ResizeObserver', ResizeObserverMock);
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
});
