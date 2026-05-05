import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTextEditorPopupAnchorResizeTracker } from './textEditorPopupAnchorResize';

class MockResizeObserver {
  static instances: MockResizeObserver[] = [];

  callback: ResizeObserverCallback;
  observed: Element[] = [];
  disconnect = vi.fn(() => {
    this.observed = [];
  });

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    MockResizeObserver.instances.push(this);
  }

  observe = vi.fn((target: Element) => {
    this.observed.push(target);
  });
}

describe('textEditorPopupAnchorResize', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    MockResizeObserver.instances = [];
  });

  it('tracks the current anchor and disconnects when it changes', () => {
    vi.stubGlobal('ResizeObserver', MockResizeObserver);
    const firstAnchor = document.createElement('div');
    const secondAnchor = document.createElement('div');
    const resolveAnchor = vi
      .fn<() => HTMLElement | null>()
      .mockReturnValueOnce(firstAnchor)
      .mockReturnValueOnce(firstAnchor)
      .mockReturnValueOnce(secondAnchor);
    const tracker = createTextEditorPopupAnchorResizeTracker({
      resolveAnchor,
      onAnchorResize: vi.fn(),
    });

    tracker.update();
    tracker.update();
    tracker.update();

    const observer = MockResizeObserver.instances[0];
    expect(observer.observe).toHaveBeenCalledTimes(2);
    expect(observer.observe).toHaveBeenNthCalledWith(1, firstAnchor);
    expect(observer.observe).toHaveBeenNthCalledWith(2, secondAnchor);
    expect(observer.disconnect).toHaveBeenCalledTimes(1);
  });

  it('schedules one reposition callback per animation frame when the anchor resizes', () => {
    vi.stubGlobal('ResizeObserver', MockResizeObserver);
    const requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.stubGlobal('requestAnimationFrame', requestAnimationFrame);
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    const onAnchorResize = vi.fn();
    const tracker = createTextEditorPopupAnchorResizeTracker({
      resolveAnchor: () => document.createElement('div'),
      onAnchorResize,
    });

    tracker.update();
    MockResizeObserver.instances[0].callback([], MockResizeObserver.instances[0] as never);

    expect(requestAnimationFrame).toHaveBeenCalledTimes(1);
    expect(onAnchorResize).toHaveBeenCalledTimes(1);
  });
});
