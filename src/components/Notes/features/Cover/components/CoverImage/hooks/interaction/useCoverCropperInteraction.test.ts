import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useCoverCropperInteraction } from './useCoverCropperInteraction';

function createProps(overrides?: Partial<Parameters<typeof useCoverCropperInteraction>[0]>) {
  return {
    displaySrc: 'blob:cover',
    crop: { x: 10, y: -12 },
    zoom: 1.5,
    effectiveMinZoom: 1,
    effectiveMaxZoom: 3,
    onCropperCropChange: vi.fn(),
    onCropperZoomChange: vi.fn(),
    onPointerIntent: vi.fn(),
    onPointerMoveIntent: vi.fn(),
    onNonPointerIntent: vi.fn(),
    onInteractionStart: vi.fn(),
    onInteractionEnd: vi.fn(),
    ...overrides,
  };
}

describe('useCoverCropperInteraction', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('runs a wheel interaction as a single session and prevents page scrolling', () => {
    vi.useFakeTimers();
    const props = createProps();
    const wrapper = document.createElement('div');

    const { result } = renderHook((nextProps) => useCoverCropperInteraction(nextProps), {
      initialProps: props,
    });

    act(() => {
      result.current.bindWheelTarget(wrapper);
    });
    vi.spyOn(wrapper, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      left: 10,
      top: 20,
      right: 210,
      bottom: 120,
      width: 200,
      height: 100,
      toJSON: () => ({}),
    });

    const wheelEvent = new WheelEvent('wheel', {
      deltaY: 100,
      clientX: 160,
      clientY: 90,
      cancelable: true,
    });

    act(() => {
      wrapper.dispatchEvent(wheelEvent);
    });

    expect(wheelEvent.defaultPrevented).toBe(true);
    expect(props.onNonPointerIntent).toHaveBeenCalledTimes(1);
    expect(props.onInteractionStart).toHaveBeenCalledTimes(1);
    expect(props.onCropperZoomChange).toHaveBeenCalledTimes(1);
    expect(props.onCropperZoomChange).toHaveBeenCalledWith(expect.any(Number), { x: 50, y: 20 });
    expect(props.onInteractionEnd).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(120);
    });

    expect(props.onInteractionEnd).toHaveBeenCalledTimes(1);
  });

  it('ignores wheel and pointer input when no display source is available', () => {
    const props = createProps({
      displaySrc: '',
    });
    const wrapper = document.createElement('div');

    const { result } = renderHook((nextProps) => useCoverCropperInteraction(nextProps), {
      initialProps: props,
    });

    act(() => {
      result.current.bindWheelTarget(wrapper);
    });

    const wheelEvent = new WheelEvent('wheel', {
      deltaY: 80,
      cancelable: true,
    });

    act(() => {
      wrapper.dispatchEvent(wheelEvent);
      result.current.handlePointerDown({
        clientX: 20,
        clientY: 40,
        pointerId: 1,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        currentTarget: {
          setPointerCapture: vi.fn(),
        },
      } as unknown as React.PointerEvent<HTMLDivElement>);
    });

    expect(wheelEvent.defaultPrevented).toBe(false);
    expect(props.onInteractionStart).not.toHaveBeenCalled();
    expect(props.onCropperZoomChange).not.toHaveBeenCalled();
    expect(props.onPointerIntent).not.toHaveBeenCalled();
  });

  it('accumulates rapid wheel zoom before React rerenders', () => {
    const props = createProps({
      zoom: 1,
    });
    const wrapper = document.createElement('div');
    vi.spyOn(wrapper, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 200,
      bottom: 100,
      width: 200,
      height: 100,
      toJSON: () => ({}),
    });

    const { result } = renderHook((nextProps) => useCoverCropperInteraction(nextProps), {
      initialProps: props,
    });

    act(() => {
      result.current.bindWheelTarget(wrapper);
      wrapper.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, clientX: 100, clientY: 50, cancelable: true }));
      wrapper.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, clientX: 100, clientY: 50, cancelable: true }));
    });

    const zoomChange = vi.mocked(props.onCropperZoomChange);
    const firstZoom = zoomChange.mock.calls[0]?.[0];
    const secondZoom = zoomChange.mock.calls[1]?.[0];

    expect(props.onCropperZoomChange).toHaveBeenCalledTimes(2);
    expect(firstZoom).toBeDefined();
    expect(secondZoom).toBeDefined();
    expect(secondZoom!).toBeGreaterThan(firstZoom!);
  });

  it('tracks pointer drag updates and ends only for the active pointer', () => {
    const props = createProps();
    const setPointerCapture = vi.fn();
    const releasePointerCapture = vi.fn();
    const hasPointerCapture = vi.fn(() => true);

    const { result } = renderHook((nextProps) => useCoverCropperInteraction(nextProps), {
      initialProps: props,
    });

    act(() => {
      result.current.handlePointerDown({
        clientX: 100,
        clientY: 120,
        pointerId: 7,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        currentTarget: {
          setPointerCapture,
        },
      } as unknown as React.PointerEvent<HTMLDivElement>);
    });

    act(() => {
      result.current.handlePointerMove({
        clientX: 118,
        clientY: 95,
        pointerId: 7,
        stopPropagation: vi.fn(),
      } as unknown as React.PointerEvent<HTMLDivElement>);
    });

    expect(props.onPointerIntent).toHaveBeenCalledWith(100, 120);
    expect(props.onPointerMoveIntent).toHaveBeenCalledWith(118, 95);
    expect(props.onCropperCropChange).toHaveBeenCalledWith({ x: 28, y: -37 });
    expect(props.onInteractionStart).toHaveBeenCalledTimes(1);
    expect(setPointerCapture).toHaveBeenCalledWith(7);

    act(() => {
      result.current.handlePointerEnd({
        pointerId: 8,
        stopPropagation: vi.fn(),
        currentTarget: {
          hasPointerCapture,
          releasePointerCapture,
        },
      } as unknown as React.PointerEvent<HTMLDivElement>);
    });

    expect(props.onInteractionEnd).not.toHaveBeenCalled();

    act(() => {
      result.current.handlePointerEnd({
        pointerId: 7,
        stopPropagation: vi.fn(),
        currentTarget: {
          hasPointerCapture,
          releasePointerCapture,
        },
      } as unknown as React.PointerEvent<HTMLDivElement>);
    });

    expect(releasePointerCapture).toHaveBeenCalledWith(7);
    expect(props.onInteractionEnd).toHaveBeenCalledTimes(1);
  });

  it('ends an active interaction when the bound node is detached', () => {
    vi.useFakeTimers();
    const props = createProps();
    const wrapper = document.createElement('div');

    const { result } = renderHook((nextProps) => useCoverCropperInteraction(nextProps), {
      initialProps: props,
    });

    act(() => {
      result.current.bindWheelTarget(wrapper);
      wrapper.dispatchEvent(new WheelEvent('wheel', { deltaY: 60, cancelable: true }));
    });

    expect(props.onInteractionStart).toHaveBeenCalledTimes(1);
    expect(props.onInteractionEnd).not.toHaveBeenCalled();

    act(() => {
      result.current.bindWheelTarget(null);
    });

    expect(props.onInteractionEnd).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(120);
    });

    expect(props.onInteractionEnd).toHaveBeenCalledTimes(1);
  });

  it('ignores non-primary mouse buttons', () => {
    const props = createProps();
    const { result } = renderHook((nextProps) => useCoverCropperInteraction(nextProps), {
      initialProps: props,
    });

    act(() => {
      result.current.handlePointerDown({
        clientX: 40,
        clientY: 50,
        pointerId: 3,
        pointerType: 'mouse',
        button: 1,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        currentTarget: {
          setPointerCapture: vi.fn(),
        },
      } as unknown as React.PointerEvent<HTMLDivElement>);
    });

    expect(props.onInteractionStart).not.toHaveBeenCalled();
    expect(props.onPointerIntent).not.toHaveBeenCalled();
  });
});
