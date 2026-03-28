import { act, render, screen } from '@testing-library/react';
import { useEffect, useRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { useSidebarSearchControls } from './useSidebarSearchControls';

function setScrollableMetrics(
  element: HTMLDivElement,
  metrics: { scrollTop?: number },
) {
  let currentScrollTop = metrics.scrollTop ?? 0;

  Object.defineProperty(element, 'scrollTop', {
    configurable: true,
    get: () => currentScrollTop,
    set: (value: number) => {
      currentScrollTop = value;
    },
  });
}

function SidebarSearchControlsHarness({
  isOpen,
  query,
  onOpen,
  onClose,
}: {
  isOpen: boolean;
  query: string;
  onOpen: () => void;
  onClose: () => void;
}) {
  const interactionScopeRef = useRef<HTMLDivElement | null>(null);
  const { scrollRootRef } = useSidebarSearchControls({
    isOpen,
    query,
    onOpen,
    onClose,
    interactionScopeRef,
  });

  useEffect(() => {
    const element = scrollRootRef.current;
    if (!element) {
      return;
    }

    setScrollableMetrics(element, { scrollTop: 0 });
  }, [scrollRootRef]);

  return (
    <div ref={interactionScopeRef} data-testid="interaction-scope">
      <div ref={scrollRootRef} data-testid="scroll-root" />
    </div>
  );
}

describe('useSidebarSearchControls', () => {
  it('prevents the close wheel from propagating into the scroll area when the empty search drawer closes', () => {
    const onOpen = vi.fn();
    const onClose = vi.fn();

    render(
      <SidebarSearchControlsHarness
        isOpen
        query=""
        onOpen={onOpen}
        onClose={onClose}
      />,
    );

    const interactionScope = screen.getByTestId('interaction-scope');
    const wheelEvent = new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      deltaY: 100,
    });

    act(() => {
      interactionScope.dispatchEvent(wheelEvent);
    });

    expect(wheelEvent.defaultPrevented).toBe(true);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('prevents the open wheel from propagating once the overscroll threshold is reached', () => {
    const onOpen = vi.fn();
    const onClose = vi.fn();

    render(
      <SidebarSearchControlsHarness
        isOpen={false}
        query=""
        onOpen={onOpen}
        onClose={onClose}
      />,
    );

    const interactionScope = screen.getByTestId('interaction-scope');
    const wheelEvent = new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      deltaY: -100,
    });

    act(() => {
      interactionScope.dispatchEvent(wheelEvent);
    });

    expect(wheelEvent.defaultPrevented).toBe(true);
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });
});
