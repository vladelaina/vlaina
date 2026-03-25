import { render, screen, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRef } from 'react';
import { useHeldPageScroll } from './useHeldPageScroll';

function setScrollableMetrics(element: HTMLDivElement, metrics: { clientHeight: number; scrollHeight: number; scrollTop?: number }) {
  Object.defineProperty(element, 'clientHeight', {
    configurable: true,
    get: () => metrics.clientHeight,
  });
  Object.defineProperty(element, 'scrollHeight', {
    configurable: true,
    get: () => metrics.scrollHeight,
  });

  let currentScrollTop = metrics.scrollTop ?? 0;
  Object.defineProperty(element, 'scrollTop', {
    configurable: true,
    get: () => currentScrollTop,
    set: (value: number) => {
      currentScrollTop = value;
    },
  });
}

function PageScrollHarness({
  useScope = false,
  includeInput = false,
}: {
  useScope?: boolean;
  includeInput?: boolean;
}) {
  const scopeRef = useRef<HTMLDivElement | null>(null);
  const ref = useRef<HTMLDivElement | null>(null);
  useHeldPageScroll(ref, {
    scopeRef: useScope ? scopeRef : undefined,
    ignoreEditableTargets: includeInput,
  });

  return (
    <div ref={scopeRef} data-testid="scope-root">
      <div ref={ref}>
        <div data-testid="inside">content</div>
      </div>
      {includeInput ? <textarea data-testid="editor-input" /> : null}
    </div>
  );
}

describe('useHeldPageScroll', () => {
  const originalRaf = globalThis.requestAnimationFrame;
  const originalCancelRaf = globalThis.cancelAnimationFrame;
  let rafCallbacks = new Map<number, FrameRequestCallback>();
  let rafId = 0;

  const flushAnimationFrame = (timestamp: number) => {
    const callbacks = [...rafCallbacks.entries()];
    rafCallbacks = new Map();
    callbacks.forEach(([id, callback]) => {
      if (!rafCallbacks.has(id)) {
        callback(timestamp);
      }
    });
  };

  beforeEach(() => {
    vi.useFakeTimers();
    rafCallbacks = new Map();
    rafId = 0;
    globalThis.requestAnimationFrame = ((callback: FrameRequestCallback) => {
      const id = ++rafId;
      rafCallbacks.set(id, callback);
      return id;
    }) as typeof requestAnimationFrame;
    globalThis.cancelAnimationFrame = ((id: number) => {
      rafCallbacks.delete(id);
    }) as typeof cancelAnimationFrame;
  });

  afterEach(() => {
    vi.useRealTimers();
    globalThis.requestAnimationFrame = originalRaf;
    globalThis.cancelAnimationFrame = originalCancelRaf;
  });

  it('applies an immediate small scroll step on PageDown', () => {
    render(<PageScrollHarness />);

    const target = screen.getByTestId('inside');
    const scrollRoot = target.parentElement as HTMLDivElement;
    setScrollableMetrics(scrollRoot, { clientHeight: 800, scrollHeight: 4000, scrollTop: 0 });

    fireEvent.keyDown(target, { key: 'PageDown' });
    flushAnimationFrame(16);
    flushAnimationFrame(32);

    expect(scrollRoot.scrollTop).toBeGreaterThan(30);
    expect(scrollRoot.scrollTop).toBeLessThan(176);
  });

  it('keeps scrolling smoothly while the key is held and stops on keyup', () => {
    render(<PageScrollHarness />);

    const target = screen.getByTestId('inside');
    const scrollRoot = target.parentElement as HTMLDivElement;
    setScrollableMetrics(scrollRoot, { clientHeight: 800, scrollHeight: 4000, scrollTop: 0 });

    fireEvent.keyDown(target, { key: 'PageDown' });
    flushAnimationFrame(16);
    flushAnimationFrame(32);
    const initialAnimatedScrollTop = scrollRoot.scrollTop;
    expect(initialAnimatedScrollTop).toBeGreaterThan(30);

    vi.advanceTimersByTime(110);
    flushAnimationFrame(48);
    flushAnimationFrame(64);

    expect(scrollRoot.scrollTop).toBeGreaterThan(initialAnimatedScrollTop);
    const scrollTopWhileHeld = scrollRoot.scrollTop;

    fireEvent.keyUp(target, { key: 'PageDown' });
    flushAnimationFrame(80);
    flushAnimationFrame(96);
    flushAnimationFrame(112);
    const scrollTopAfterRelease = scrollRoot.scrollTop;

    expect(scrollTopAfterRelease).toBeGreaterThanOrEqual(scrollTopWhileHeld);

    flushAnimationFrame(128);
    flushAnimationFrame(160);
    flushAnimationFrame(192);

    expect(scrollRoot.scrollTop).toBeGreaterThanOrEqual(scrollTopAfterRelease);
  });

  it('ignores PageUp and PageDown events dispatched outside the bound scroll root', () => {
    render(
      <div>
        <PageScrollHarness />
        <button data-testid="outside" type="button">
          outside
        </button>
      </div>
    );

    const inside = screen.getByTestId('inside');
    const outside = screen.getByTestId('outside');
    const scrollRoot = inside.parentElement as HTMLDivElement;
    setScrollableMetrics(scrollRoot, { clientHeight: 800, scrollHeight: 4000, scrollTop: 120 });

    fireEvent.keyDown(outside, { key: 'PageDown' });

    expect(scrollRoot.scrollTop).toBe(120);
  });

  it('responds while hovered even when the scroll region is not focused', () => {
    render(
      <div>
        <PageScrollHarness />
        <button data-testid="outside" type="button">
          outside
        </button>
      </div>
    );

    const inside = screen.getByTestId('inside');
    const outside = screen.getByTestId('outside');
    const scrollRoot = inside.parentElement as HTMLDivElement;
    setScrollableMetrics(scrollRoot, { clientHeight: 800, scrollHeight: 4000, scrollTop: 120 });

    fireEvent.pointerEnter(scrollRoot);
    fireEvent.keyDown(outside, { key: 'PageDown' });
    flushAnimationFrame(16);
    flushAnimationFrame(32);

    expect(scrollRoot.scrollTop).toBeGreaterThan(120);
  });

  it('supports a wider scope root while still ignoring editable inputs', () => {
    render(<PageScrollHarness useScope includeInput />);

    const inside = screen.getByTestId('inside');
    const input = screen.getByTestId('editor-input');
    const scrollRoot = inside.parentElement as HTMLDivElement;
    setScrollableMetrics(scrollRoot, { clientHeight: 800, scrollHeight: 4000, scrollTop: 120 });

    fireEvent.keyDown(input, { key: 'PageDown' });
    expect(scrollRoot.scrollTop).toBe(120);

    fireEvent.keyDown(inside, { key: 'PageDown' });
    flushAnimationFrame(16);
    flushAnimationFrame(32);
    expect(scrollRoot.scrollTop).toBeGreaterThan(120);
  });

  it('allows hovered scrolling when focus remains in an editable target outside the hover scope', () => {
    render(
      <div>
        <PageScrollHarness />
        <textarea data-testid="outside-editor" />
      </div>
    );

    const inside = screen.getByTestId('inside');
    const outsideEditor = screen.getByTestId('outside-editor');
    const scrollRoot = inside.parentElement as HTMLDivElement;
    setScrollableMetrics(scrollRoot, { clientHeight: 800, scrollHeight: 4000, scrollTop: 120 });

    fireEvent.pointerEnter(scrollRoot);
    fireEvent.keyDown(outsideEditor, { key: 'PageDown' });
    flushAnimationFrame(16);
    flushAnimationFrame(32);

    expect(scrollRoot.scrollTop).toBeGreaterThan(120);
  });

  it('allows hovered scrolling when focus remains in an editable target inside the scope but outside the scroll root', () => {
    render(<PageScrollHarness useScope includeInput />);

    const inside = screen.getByTestId('inside');
    const scopeRoot = screen.getByTestId('scope-root');
    const input = screen.getByTestId('editor-input');
    const scrollRoot = inside.parentElement as HTMLDivElement;
    setScrollableMetrics(scrollRoot, { clientHeight: 800, scrollHeight: 4000, scrollTop: 120 });

    fireEvent.pointerEnter(scopeRoot);
    fireEvent.keyDown(input, { key: 'PageDown' });
    flushAnimationFrame(16);
    flushAnimationFrame(32);

    expect(scrollRoot.scrollTop).toBeGreaterThan(120);
  });

  it('yields immediately to manual wheel scrolling intent', () => {
    render(<PageScrollHarness />);

    const target = screen.getByTestId('inside');
    const scrollRoot = target.parentElement as HTMLDivElement;
    setScrollableMetrics(scrollRoot, { clientHeight: 800, scrollHeight: 4000, scrollTop: 0 });

    fireEvent.keyDown(target, { key: 'PageDown' });
    vi.advanceTimersByTime(110);
    flushAnimationFrame(16);
    flushAnimationFrame(32);
    const scrollTopBeforeWheel = scrollRoot.scrollTop;

    fireEvent.wheel(target, { deltaY: -120 });
    flushAnimationFrame(48);
    flushAnimationFrame(64);
    flushAnimationFrame(80);

    expect(scrollRoot.scrollTop).toBe(scrollTopBeforeWheel);
  });
});
