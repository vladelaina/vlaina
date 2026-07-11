import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveDefaultCoverHeight } from '../../../../utils/coverConstants';
import { useAutomaticCoverHeight } from './useAutomaticCoverHeight';

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

describe('useAutomaticCoverHeight', () => {
  beforeEach(() => {
    ResizeObserverMock.instances = [];
    vi.stubGlobal('ResizeObserver', ResizeObserverMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses and observes the containing note viewport height', () => {
    const viewport = document.createElement('div');
    viewport.setAttribute('data-note-cover-viewport', 'true');
    const container = document.createElement('div');
    viewport.appendChild(container);
    Object.defineProperty(viewport, 'clientHeight', { configurable: true, value: 720 });
    const setCoverHeight = vi.fn();

    const { unmount } = renderHook(() => useAutomaticCoverHeight({
      containerRef: { current: container },
      enabled: true,
      observeKey: 'cover-a',
      setCoverHeight,
    }));

    expect(setCoverHeight).toHaveBeenLastCalledWith(resolveDefaultCoverHeight(720));
    expect(ResizeObserverMock.instances[0]?.observe).toHaveBeenCalledWith(viewport);

    Object.defineProperty(viewport, 'clientHeight', { configurable: true, value: 540 });
    act(() => {
      const observer = ResizeObserverMock.instances[0];
      observer?.callback([], observer as unknown as ResizeObserver);
    });
    expect(setCoverHeight).toHaveBeenLastCalledWith(resolveDefaultCoverHeight(540));

    unmount();
    expect(ResizeObserverMock.instances[0]?.disconnect).toHaveBeenCalledTimes(1);
  });

  it('does not observe the viewport for an explicitly stored height', () => {
    const viewport = document.createElement('div');
    viewport.setAttribute('data-note-cover-viewport', 'true');
    const container = document.createElement('div');
    viewport.appendChild(container);
    const setCoverHeight = vi.fn();

    renderHook(() => useAutomaticCoverHeight({
      containerRef: { current: container },
      enabled: false,
      observeKey: 'cover-a',
      setCoverHeight,
    }));

    expect(setCoverHeight).not.toHaveBeenCalled();
    expect(ResizeObserverMock.instances).toHaveLength(0);
  });
});
