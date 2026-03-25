import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OverlayScrollArea } from './overlay-scroll-area';

class ResizeObserverMock {
  observe() {}
  disconnect() {}
}

function setViewportMetrics(element: HTMLDivElement, metrics: { clientHeight: number; scrollHeight: number; scrollTop?: number }) {
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

describe('OverlayScrollArea', () => {
  const originalResizeObserver = globalThis.ResizeObserver;

  beforeEach(() => {
    globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;
  });

  afterEach(() => {
    globalThis.ResizeObserver = originalResizeObserver;
    document.body.className = '';
  });

  it('toggles the configured body class while dragging the thumb', () => {
    render(
      <div style={{ height: 120 }}>
        <OverlayScrollArea draggingBodyClassName="vlaina-overlay-scrollbar-dragging">
          <div style={{ height: 480 }}>content</div>
        </OverlayScrollArea>
      </div>
    );

    const viewport = screen.getByText('content').parentElement as HTMLDivElement;
    setViewportMetrics(viewport, { clientHeight: 120, scrollHeight: 480 });
    fireEvent.scroll(viewport);

    const thumb = viewport.parentElement?.querySelector('.pointer-events-auto.absolute') as HTMLDivElement | null;
    expect(thumb).not.toBeNull();

    Object.defineProperty(thumb!, 'setPointerCapture', {
      configurable: true,
      value: vi.fn(),
    });

    fireEvent.pointerDown(thumb!, { button: 0, clientY: 10, pointerId: 1 });
    expect(document.body.classList.contains('vlaina-overlay-scrollbar-dragging')).toBe(true);

    fireEvent.pointerUp(window, { pointerId: 1 });
    expect(document.body.classList.contains('vlaina-overlay-scrollbar-dragging')).toBe(false);
  });

  it('supports a compact scrollbar variant without changing the default sizing', () => {
    const { rerender } = render(
      <div style={{ height: 120 }}>
        <OverlayScrollArea scrollbarVariant="compact">
          <div style={{ height: 480 }}>content</div>
        </OverlayScrollArea>
      </div>
    );

    const viewport = screen.getByText('content').parentElement as HTMLDivElement;
    setViewportMetrics(viewport, { clientHeight: 120, scrollHeight: 480 });
    fireEvent.scroll(viewport);

    const compactRail = viewport.parentElement?.querySelector('.absolute.inset-y-0.right-0') as HTMLDivElement | null;
    const compactTrack = compactRail?.firstElementChild as HTMLDivElement | null;
    const compactThumb = compactTrack?.firstElementChild as HTMLDivElement | null;

    expect(compactRail?.className).toContain('w-[7px]');
    expect(compactRail?.className).toContain('justify-end');
    expect(compactTrack?.className).toContain('w-[7px]');
    expect(compactThumb?.className).toContain('w-[5px]');

    rerender(
      <div style={{ height: 120 }}>
        <OverlayScrollArea>
          <div style={{ height: 480 }}>content</div>
        </OverlayScrollArea>
      </div>
    );

    const defaultViewport = screen.getByText('content').parentElement as HTMLDivElement;
    setViewportMetrics(defaultViewport, { clientHeight: 120, scrollHeight: 480 });
    fireEvent.scroll(defaultViewport);

    const defaultRail = defaultViewport.parentElement?.querySelector('.absolute.inset-y-0.right-0') as HTMLDivElement | null;
    const defaultTrack = defaultRail?.firstElementChild as HTMLDivElement | null;
    const defaultThumb = defaultTrack?.firstElementChild as HTMLDivElement | null;

    expect(defaultRail?.className).toContain('w-4');
    expect(defaultRail?.className).toContain('justify-center');
    expect(defaultTrack?.className).toContain('w-3');
    expect(defaultThumb?.className).toContain('w-2');
  });

  it('expands the compact scrollbar on hover and uses the default cursor', () => {
    render(
      <div style={{ height: 120 }}>
        <OverlayScrollArea scrollbarVariant="compact">
          <div style={{ height: 480 }}>content</div>
        </OverlayScrollArea>
      </div>
    );

    const viewport = screen.getByText('content').parentElement as HTMLDivElement;
    setViewportMetrics(viewport, { clientHeight: 120, scrollHeight: 480 });
    fireEvent.mouseEnter(viewport.parentElement as HTMLDivElement);
    fireEvent.scroll(viewport);

    const rail = viewport.parentElement?.querySelector('.absolute.inset-y-0.right-0') as HTMLDivElement | null;
    const track = rail?.firstElementChild as HTMLDivElement | null;
    const thumb = track?.firstElementChild as HTMLDivElement | null;

    expect(rail?.className).toContain('cursor-default');
    expect(track?.className).toContain('cursor-default');
    expect(thumb?.className).toContain('cursor-default');

    fireEvent.pointerEnter(rail!);

    expect(rail?.className).toContain('w-4');
    expect(track?.className).toContain('w-3');
    expect(thumb?.className).toContain('w-2');
    expect(thumb?.className).toContain('right-[2px]');
    expect(thumb?.className).toContain('bg-[rgba(120,120,120,0.5)]');
  });
});
