import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createVerticalEdgeAutoScroll,
  resolveVerticalEdgeAutoScrollDelta,
  VERTICAL_EDGE_AUTO_SCROLL_MAX_STEP_PX,
} from './edgeAutoScroll';

afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

describe('edgeAutoScroll', () => {
  const scrollRootRect = { top: 100, bottom: 500 };

  it('uses a shared faster vertical edge scroll curve', () => {
    expect(resolveVerticalEdgeAutoScrollDelta(260, scrollRootRect)).toBe(0);
    expect(resolveVerticalEdgeAutoScrollDelta(140, scrollRootRect)).toBeLessThan(0);
    expect(resolveVerticalEdgeAutoScrollDelta(80, scrollRootRect)).toBe(-VERTICAL_EDGE_AUTO_SCROLL_MAX_STEP_PX);
    expect(resolveVerticalEdgeAutoScrollDelta(460, scrollRootRect)).toBeGreaterThan(0);
    expect(resolveVerticalEdgeAutoScrollDelta(520, scrollRootRect)).toBe(VERTICAL_EDGE_AUTO_SCROLL_MAX_STEP_PX);
  });

  it('uses the nearest edge when the top and bottom trigger zones overlap', () => {
    expect(resolveVerticalEdgeAutoScrollDelta(5, { top: 0, bottom: 100 })).toBeLessThan(0);
    expect(resolveVerticalEdgeAutoScrollDelta(50, { top: 0, bottom: 100 })).toBe(0);
    expect(resolveVerticalEdgeAutoScrollDelta(95, { top: 0, bottom: 100 })).toBeGreaterThan(0);
  });

  it('drives scroll roots through the shared animation-frame loop', () => {
    const animationFrames: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback: FrameRequestCallback) => {
      animationFrames.push(callback);
      return animationFrames.length;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(vi.fn());

    const scrollRoot = document.createElement('div');
    scrollRoot.scrollTop = 100;
    Object.defineProperty(scrollRoot, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({
        top: 100,
        bottom: 500,
      }),
    });

    const onScroll = vi.fn();
    const autoScroll = createVerticalEdgeAutoScroll({
      scrollRoot,
      getPointerY: () => 520,
      onScroll,
    });

    autoScroll.start();
    animationFrames.shift()?.(0);

    expect(scrollRoot.scrollTop).toBe(100 + VERTICAL_EDGE_AUTO_SCROLL_MAX_STEP_PX);
    expect(onScroll).toHaveBeenCalledTimes(1);

    autoScroll.stop();
  });
});
