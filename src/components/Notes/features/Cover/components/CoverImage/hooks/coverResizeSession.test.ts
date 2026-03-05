import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { startCoverResizeSession } from './coverResizeSession';
import type { ResizeSnapshot } from '../../../utils/coverResizeMath';

const snapshot: ResizeSnapshot = {
  scaledWidth: 400,
  scaledHeight: 300,
  absoluteTop: -20,
  absoluteLeft: 0,
  containerWidth: 320,
  maxVisualHeightNoShift: 280,
  maxShiftDown: 20,
  maxMechanicalHeight: 300,
};

describe('startCoverResizeSession', () => {
  const originalRaf = globalThis.requestAnimationFrame;
  const originalCancelRaf = globalThis.cancelAnimationFrame;

  beforeEach(() => {
    globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
      cb(0);
      return 1;
    }) as typeof requestAnimationFrame;
    globalThis.cancelAnimationFrame = vi.fn();
  });

  afterEach(() => {
    globalThis.requestAnimationFrame = originalRaf;
    globalThis.cancelAnimationFrame = originalCancelRaf;
    vi.restoreAllMocks();
  });

  it('runs frame callback on mouse move', () => {
    const onFrame = vi.fn();
    const onCommit = vi.fn();
    const addSpy = vi.spyOn(document, 'addEventListener');

    startCoverResizeSession({
      startY: 100,
      startHeight: 200,
      snapshot,
      onFrame,
      onCommit,
    });

    const moveHandler = addSpy.mock.calls.find(([eventName]) => eventName === 'mousemove')?.[1];
    expect(moveHandler).toBeTypeOf('function');

    (moveHandler as EventListener)(new MouseEvent('mousemove', { clientY: 120 }));
    expect(onFrame).toHaveBeenCalledTimes(1);
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('commits and removes listeners on mouse up', () => {
    const onFrame = vi.fn();
    const onCommit = vi.fn();
    const addSpy = vi.spyOn(document, 'addEventListener');
    const removeSpy = vi.spyOn(document, 'removeEventListener');

    startCoverResizeSession({
      startY: 100,
      startHeight: 200,
      snapshot,
      onFrame,
      onCommit,
    });

    const upHandler = addSpy.mock.calls.find(([eventName]) => eventName === 'mouseup')?.[1];
    expect(upHandler).toBeTypeOf('function');

    (upHandler as EventListener)(new MouseEvent('mouseup', { clientY: 130 }));

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(removeSpy).toHaveBeenCalledWith('mousemove', expect.any(Function));
    expect(removeSpy).toHaveBeenCalledWith('mouseup', expect.any(Function));
  });

  it('dispose is idempotent', () => {
    const onFrame = vi.fn();
    const onCommit = vi.fn();
    const removeSpy = vi.spyOn(document, 'removeEventListener');

    const dispose = startCoverResizeSession({
      startY: 100,
      startHeight: 200,
      snapshot,
      onFrame,
      onCommit,
    });

    dispose();
    dispose();

    const moveRemoves = removeSpy.mock.calls.filter(([name]) => name === 'mousemove');
    const upRemoves = removeSpy.mock.calls.filter(([name]) => name === 'mouseup');

    expect(moveRemoves).toHaveLength(1);
    expect(upRemoves).toHaveLength(1);
  });
});
